import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pass } from '../../models/Pass.js';
import { env } from '../../config/env.js';

const KEY_ID = 'edkl-k1';
const KEYS_FILE = path.resolve(process.cwd(), '.edkl_keys.json');

let privateKeyObject = null;
let publicKeyObject = null;
let publicKeySpkiBase64 = '';

/**
 * Initialize Ed25519 Asymmetric Key Pair
 */
function initKeys() {
  if (privateKeyObject && publicKeyObject) return;

  // 1. Check if keys exist in environment
  const envPrivKey = process.env.QR_SIGNING_PRIVATE_KEY;
  const envPubKey = process.env.QR_SIGNING_PUBLIC_KEY;

  if (envPrivKey && envPubKey) {
    try {
      privateKeyObject = crypto.createPrivateKey(envPrivKey);
      publicKeyObject = crypto.createPublicKey(envPubKey);
      publicKeySpkiBase64 = publicKeyObject.export({ type: 'spki', format: 'der' }).toString('base64');
      return;
    } catch (e) {
      console.warn('[QrPassService] Failed to load keys from env, falling back to local store.', e.message);
    }
  }

  // 2. Check if keys exist in local keys file
  if (fs.existsSync(KEYS_FILE)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      if (fileData.privateKeyPem && fileData.publicKeyPem) {
        privateKeyObject = crypto.createPrivateKey(fileData.privateKeyPem);
        publicKeyObject = crypto.createPublicKey(fileData.publicKeyPem);
        publicKeySpkiBase64 = publicKeyObject.export({ type: 'spki', format: 'der' }).toString('base64');
        return;
      }
    } catch (e) {
      console.warn('[QrPassService] Failed to parse existing keys file:', e.message);
    }
  }

  // 3. Generate new Ed25519 keypair
  console.log('[QrPassService] Generating new secure Ed25519 key pair for QR signing...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  privateKeyObject = privateKey;
  publicKeyObject = publicKey;

  const privPem = privateKeyObject.export({ type: 'pkcs8', format: 'pem' });
  const pubPem = publicKeyObject.export({ type: 'spki', format: 'pem' });
  publicKeySpkiBase64 = publicKeyObject.export({ type: 'spki', format: 'der' }).toString('base64');

  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({
      keyId: KEY_ID,
      createdAt: new Date().toISOString(),
      privateKeyPem: privPem,
      publicKeyPem: pubPem,
      publicKeySpkiBase64
    }, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn('[QrPassService] Could not persist keys file:', err.message);
  }
}

// Initialize keys on startup
initKeys();

/**
 * Deterministic Canonical JSON stringification (Alphabetically sorted keys)
 */
export function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(item => canonicalStringify(item)).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Sign a Pass Payload using Ed25519 Private Key
 * Returns: base64url(canonicalPayload).base64url(signature)
 */
export function signPassPayload(payload) {
  initKeys();
  const canonicalJson = canonicalStringify(payload);
  const dataBuffer = Buffer.from(canonicalJson, 'utf8');

  const signatureBuffer = crypto.sign(null, dataBuffer, privateKeyObject);

  const encodedPayload = Buffer.from(canonicalJson, 'utf8').toString('base64url');
  const encodedSignature = signatureBuffer.toString('base64url');

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify a Signed QR Token using Ed25519 Public Key
 */
export function verifyPassToken(token) {
  initKeys();
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'MALFORMED_TOKEN' };
  }

  const [encodedPayload, encodedSignature] = parts;

  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const signatureBuffer = Buffer.from(encodedSignature, 'base64url');
    const payload = JSON.parse(payloadJson);

    // Reconstruct canonical string to verify against signature
    const canonicalJson = canonicalStringify(payload);
    const dataBuffer = Buffer.from(canonicalJson, 'utf8');

    const isValid = crypto.verify(null, dataBuffer, publicKeyObject, signatureBuffer);

    if (!isValid) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'VERIFICATION_EXCEPTION', details: err.message };
  }
}

/**
 * Get Public Key for Offline Scanner verification
 */
export function getPublicKeyInfo() {
  initKeys();
  return {
    keyId: KEY_ID,
    algorithm: 'Ed25519',
    publicKeySpkiBase64,
    format: 'spki-der-base64'
  };
}

/**
 * Ensure a unique Pass exists for a Registration (Idempotent)
 */
export async function ensurePass(registration, event) {
  if (!registration || !registration._id) {
    throw new Error('Registration document is required to issue a pass.');
  }

  const eventId = String(registration.programId || event?.id || '');
  const inquiryId = String(registration.inquiryId || '');

  // 1. Check if Pass already exists
  let pass = await Pass.findOne({
    $or: [
      { registrationId: registration._id },
      { inquiryId, eventId }
    ]
  });

  if (pass) {
    if (!pass.qrToken) {
      const payload = {
        v: 1,
        eventId: pass.eventId,
        passId: pass.passId,
        version: pass.version || 1,
        issuedAt: Math.floor(pass.issuedAt.getTime() / 1000),
        keyId: KEY_ID
      };
      pass.qrToken = signPassPayload(payload);
      await pass.save();
    }
    return pass;
  }

  // 2. Generate new Pass
  const passId = `EDKL-P-${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
  const nowSeconds = Math.floor(Date.now() / 1000);

  const payload = {
    v: 1,
    eventId,
    passId,
    version: 1,
    issuedAt: nowSeconds,
    keyId: KEY_ID
  };

  const qrToken = signPassPayload(payload);

  pass = await Pass.create({
    passId,
    eventId,
    registrationId: registration._id,
    inquiryId,
    version: 1,
    qrVersion: 1,
    status: 'ACTIVE',
    qrToken,
    keyId: KEY_ID,
    issuedAt: new Date()
  });

  return pass;
}

/**
 * Find Pass by Inquiry ID
 */
export async function getPassByInquiryId(inquiryId) {
  if (!inquiryId) return null;
  return await Pass.findOne({
    inquiryId: { $regex: new RegExp(`^${inquiryId.trim()}$`, 'i') }
  });
}

/**
 * Revoke Pass
 */
export async function revokePass(passId, reason = 'Administrative revocation') {
  return await Pass.findOneAndUpdate(
    { passId },
    {
      $set: {
        status: 'REVOKED',
        revocationReason: reason,
        version: 2
      }
    },
    { new: true }
  );
}

export const qrPassService = {
  signPassPayload,
  verifyPassToken,
  getPublicKeyInfo,
  ensurePass,
  getPassByInquiryId,
  revokePass,
  canonicalStringify
};
