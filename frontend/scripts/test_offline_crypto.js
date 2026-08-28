/**
 * EDKL Frontend Offline Cryptographic QR Fail-Closed Test Suite
 * Validates browser WebCrypto & Ed25519 offline verification behavior
 */

import crypto from 'crypto';

// Setup simulated window.crypto & TextEncoder/Decoder for Node test environment
let mockSubtle = globalThis.crypto.subtle;

if (!globalThis.window) {
  globalThis.window = {
    get crypto() {
      return {
        get subtle() {
          return mockSubtle;
        }
      };
    },
    atob: (str) => Buffer.from(str, 'base64').toString('binary')
  };
}

function canonicalStringify(obj) {
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

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = globalThis.window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function base64ToUint8Array(base64) {
  const rawData = globalThis.window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function verifyQrTokenOffline(qrToken, publicKeySpkiBase64) {
  if (!qrToken || !qrToken.includes('.')) {
    return { valid: false, error: 'INVALID_QR', message: 'Malformed QR code format.' };
  }

  if (!publicKeySpkiBase64) {
    return { valid: false, error: 'UNKNOWN_KEY', message: 'Offline public key is missing or not configured for this event.' };
  }

  const parts = qrToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'INVALID_QR', message: 'Invalid token structure.' };
  }

  const [encodedPayload, encodedSignature] = parts;

  try {
    const payloadBytes = base64UrlToUint8Array(encodedPayload);
    const signatureBytes = base64UrlToUint8Array(encodedSignature);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadJson);

    const canonicalJson = canonicalStringify(payload);
    const canonicalBytes = new TextEncoder().encode(canonicalJson);

    if (globalThis.window.crypto && globalThis.window.crypto.subtle) {
      try {
        const spkiBytes = base64ToUint8Array(publicKeySpkiBase64);
        const cryptoKey = await globalThis.window.crypto.subtle.importKey(
          'spki',
          spkiBytes.buffer,
          { name: 'Ed25519' },
          false,
          ['verify']
        );

        const isValid = await globalThis.window.crypto.subtle.verify(
          'Ed25519',
          cryptoKey,
          signatureBytes.buffer,
          canonicalBytes.buffer
        );

        if (!isValid) {
          return { valid: false, error: 'INVALID_SIGNATURE', message: 'Signature verification failed. Potential counterfeit pass.' };
        }

        return { valid: true, payload };
      } catch (cryptoErr) {
        return {
          valid: false,
          error: 'CRYPTO_UNAVAILABLE',
          message: 'Offline secure QR verification is not supported on this browser/device. Connect to the internet or use a supported device.'
        };
      }
    }

    return {
      valid: false,
      error: 'CRYPTO_UNAVAILABLE',
      message: 'Offline secure QR verification is not supported on this browser/device. Connect to the internet or use a supported device.'
    };
  } catch (err) {
    return { valid: false, error: 'INVALID_QR', message: err.message || 'Error decoding QR payload.' };
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('EDKL FRONTEND OFFLINE CRYPTO FAIL-CLOSED TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Generate test Ed25519 keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeySpki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

  const validPayload = {
    v: 1,
    eventId: 'prog-01',
    passId: 'EDKL-P-12345678',
    version: 1,
    issuedAt: Math.floor(Date.now() / 1000),
    keyId: 'ed25519-v1'
  };

  const canonicalPayloadStr = canonicalStringify(validPayload);
  const signature = crypto.sign(null, Buffer.from(canonicalPayloadStr, 'utf8'), privateKey);
  const validToken = `${Buffer.from(JSON.stringify(validPayload)).toString('base64url')}.${signature.toString('base64url')}`;

  // TEST 1: Valid Ed25519 token
  {
    const res = await verifyQrTokenOffline(validToken, publicKeySpki);
    if (res.valid === true && res.payload?.passId === 'EDKL-P-12345678') {
      console.log('✓ TEST 1 PASS: Valid signed token returns valid: true');
      passed++;
    } else {
      console.error('✗ TEST 1 FAIL: Valid token was not verified', res);
      failed++;
    }
  }

  // TEST 2: Tampered signature -> INVALID_SIGNATURE
  {
    const tamperedSig = Buffer.from(signature);
    tamperedSig[0] ^= 0xff; // flip bits
    const tamperedToken = `${Buffer.from(JSON.stringify(validPayload)).toString('base64url')}.${tamperedSig.toString('base64url')}`;
    const res = await verifyQrTokenOffline(tamperedToken, publicKeySpki);
    if (res.valid === false && res.error === 'INVALID_SIGNATURE') {
      console.log('✓ TEST 2 PASS: Tampered signature returns INVALID_SIGNATURE');
      passed++;
    } else {
      console.error('✗ TEST 2 FAIL: Tampered signature was not rejected with INVALID_SIGNATURE', res);
      failed++;
    }
  }

  // TEST 3: Missing / Unknown Public Key -> UNKNOWN_KEY
  {
    const res = await verifyQrTokenOffline(validToken, '');
    if (res.valid === false && res.error === 'UNKNOWN_KEY') {
      console.log('✓ TEST 3 PASS: Missing public key returns UNKNOWN_KEY');
      passed++;
    } else {
      console.error('✗ TEST 3 FAIL: Missing public key did not return UNKNOWN_KEY', res);
      failed++;
    }
  }

  // TEST 4: Malformed QR Token -> INVALID_QR
  {
    const res = await verifyQrTokenOffline('not-a-valid-token', publicKeySpki);
    if (res.valid === false && res.error === 'INVALID_QR') {
      console.log('✓ TEST 4 PASS: Malformed token returns INVALID_QR');
      passed++;
    } else {
      console.error('✗ TEST 4 FAIL: Malformed token did not return INVALID_QR', res);
      failed++;
    }
  }

  // TEST 5: Crypto unavailable -> CRYPTO_UNAVAILABLE (Strict Fail-Closed)
  {
    const originalSubtle = mockSubtle;
    mockSubtle = null; // simulate unsupported browser

    const res = await verifyQrTokenOffline(validToken, publicKeySpki);
    mockSubtle = originalSubtle; // restore

    if (res.valid === false && res.error === 'CRYPTO_UNAVAILABLE') {
      console.log('✓ TEST 5 PASS: Missing WebCrypto strictly fails closed with CRYPTO_UNAVAILABLE');
      passed++;
    } else {
      console.error('✗ TEST 5 FAIL: Missing WebCrypto did not return CRYPTO_UNAVAILABLE', res);
      failed++;
    }
  }

  // TEST 6: importKey throws -> CRYPTO_UNAVAILABLE (Strict Fail-Closed)
  {
    const originalSubtle = mockSubtle;
    mockSubtle = {
      importKey: () => Promise.reject(new Error('Ed25519 unsupported algorithm')),
      verify: () => Promise.resolve(false)
    };

    const res = await verifyQrTokenOffline(validToken, publicKeySpki);
    mockSubtle = originalSubtle; // restore

    if (res.valid === false && res.error === 'CRYPTO_UNAVAILABLE') {
      console.log('✓ TEST 6 PASS: Unsupported Ed25519 algorithm strictly fails closed with CRYPTO_UNAVAILABLE');
      passed++;
    } else {
      console.error('✗ TEST 6 FAIL: Unsupported Ed25519 did not return CRYPTO_UNAVAILABLE', res);
      failed++;
    }
  }

  console.log('\n====================================================');
  console.log(`OFFLINE CRYPTO TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[FATAL TEST ERROR]', err);
  process.exit(1);
});
