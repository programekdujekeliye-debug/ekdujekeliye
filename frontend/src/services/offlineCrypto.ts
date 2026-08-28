/**
 * Client-Side Ed25519 Cryptographic QR Verification for Offline PWA Scanner
 */

export function canonicalStringify(obj: any): string {
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

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface VerifiedPayload {
  v: number;
  eventId: string;
  passId: string;
  version: number;
  issuedAt: number;
  keyId: string;
}

export interface OfflineVerifyResult {
  valid: boolean;
  payload?: VerifiedPayload;
  error?: string;
  message?: string;
}

export async function canUseOfflineEd25519(publicKeySpkiBase64: string): Promise<boolean> {
  if (!publicKeySpkiBase64 || !window.crypto?.subtle) return false;

  try {
    const spkiBytes = base64ToUint8Array(publicKeySpkiBase64);
    await window.crypto.subtle.importKey(
      'spki',
      spkiBytes.buffer as ArrayBuffer,
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify Ed25519 Signed QR Token Offline using cached Public Key
 */
export async function verifyQrTokenOffline(
  qrToken: string,
  publicKeySpkiBase64: string
): Promise<OfflineVerifyResult> {
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
    const payload: VerifiedPayload = JSON.parse(payloadJson);

    // Reconstruct canonical data string for deterministic cryptographic comparison
    const canonicalJson = canonicalStringify(payload);
    const canonicalBytes = new TextEncoder().encode(canonicalJson);

    if (window.crypto && window.crypto.subtle) {
      try {
        const spkiBytes = base64ToUint8Array(publicKeySpkiBase64);
        const cryptoKey = await window.crypto.subtle.importKey(
          'spki',
          spkiBytes.buffer as ArrayBuffer,
          { name: 'Ed25519' },
          false,
          ['verify']
        );

        const isValid = await window.crypto.subtle.verify(
          'Ed25519',
          cryptoKey,
          signatureBytes.buffer as ArrayBuffer,
          canonicalBytes.buffer as ArrayBuffer
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
  } catch (err: any) {
    return { valid: false, error: 'INVALID_QR', message: err.message || 'Error decoding QR payload.' };
  }
}
