/**
 * Helper Script: Export Ed25519 QR Signing Keys
 * Run with: node scripts/export_qr_signing_keys.js
 *
 * Use the output to set QR_SIGNING_PRIVATE_KEY and QR_SIGNING_PUBLIC_KEY
 * in your production hosting environment (e.g., Render, Railway, Docker).
 */

import { exportKeysPem } from '../src/modules/passes/qrPass.service.js';

const keys = exportKeysPem();

console.log('\n===============================================================');
console.log('ED25519 PERSISTENT QR SIGNING KEYS (Production Config)');
console.log('===============================================================\n');

console.log('Copy these exact values into your production environment variables:\n');

console.log('--- QR_SIGNING_PRIVATE_KEY ---');
console.log(JSON.stringify(keys.privateKeyPem));
console.log('\n--- QR_SIGNING_PUBLIC_KEY ---');
console.log(JSON.stringify(keys.publicKeyPem));

console.log('\n--- PUBLIC KEY SPKI (BASE64) ---');
console.log(keys.publicKeySpkiBase64);

console.log('\n===============================================================');
console.log('DONE: If set in environment, server restarts will never rotate keys!');
console.log('===============================================================\n');
