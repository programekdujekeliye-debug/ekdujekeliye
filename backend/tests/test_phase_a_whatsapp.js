/**
 * EDKL Phase A: WhatsApp Audit, Normalization, & Ledger Idempotency Test
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import {
  getWhatsAppConfigStatus,
  normalizeWhatsAppRecipient,
  sendWhatsAppMessage
} from '../src/integrations/whatsapp/whatsapp.service.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function runPhaseATests() {
  console.log('=== RUNNING PHASE A: WHATSAPP AUDIT & LEDGER TESTS ===\n');

  let passed = 0;
  let failed = 0;

  // 1. Audit Config (Must report configured/missing safely with zero raw secrets)
  const config = getWhatsAppConfigStatus();
  console.log('--- 1. WhatsApp Configuration Audit ---');
  console.log(`WABA ID Configured: ${config.wabaIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Phone Number ID: ${config.phoneIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Access Token: ${config.tokenConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Webhook Verify Token: ${config.webhookConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Ready for Direct Outbound: ${config.isReady ? 'YES' : 'PENDING CREDENTIALS'}`);

  if (typeof config.isReady === 'boolean') {
    passed++;
  } else {
    failed++;
  }

  // 2. Phone Normalization Tests
  console.log('\n--- 2. Phone Number Normalization Tests ---');
  const testPhones = [
    { input: '9825100000', expected: '919825100000' },
    { input: '+91 98251 00000', expected: '919825100000' },
    { input: '09825100000', expected: '919825100000' },
    { input: '919825100000', expected: '919825100000' },
    { input: '+91-82003-02328', expected: '918200302328' }
  ];

  let normPass = true;
  for (const test of testPhones) {
    const output = normalizeWhatsAppRecipient(test.input);
    const pass = output === test.expected;
    if (!pass) normPass = false;
    console.log(` ${pass ? '✓' : '✗'} Input: "${test.input}" -> "${output}" (Expected: "${test.expected}")`);
  }

  if (normPass) {
    passed++;
  } else {
    failed++;
  }

  // 3. Database Ledger & Idempotency Test
  console.log('\n--- 3. Database Ledger & Idempotency Test ---');
  await mongoose.connect(env.MONGO_URI);

  const testInquiryId = `TEST-WA-${Date.now()}`;
  const testIdempotencyKey = `IDEMP-TEST-${testInquiryId}`;

  // First Queue Call
  const res1 = await sendWhatsAppMessage({
    recipientPhone: '918320594829', // Allowlisted test recipient
    templateKey: 'edkl_registration_received_v1',
    languageCode: 'en_US',
    variables: {
      customerName: 'Test Rajesh & Pooja',
      eventName: 'Ek Duje Ke Liye Test Seminar',
      registrationId: 'EK01-02',
      eventDate: '15 September 2026',
      eventTime: '8:30 PM',
      venue: 'Sardar Smruti Bhavan, Surat',
      statusText: 'Pending Payment'
    },
    idempotencyKey: testIdempotencyKey,
    inquiryId: testInquiryId,
    trigger: 'test_phase_a',
    executionSource: 'AUTOMATED_TEST',
    providerMode: 'MOCK'
  });

  console.log(`✓ First Call Result: Status ${res1.status}, Provider Message ID: ${res1.providerMessageId || 'N/A'}`);

  // Second Call with same idempotency key (Simulating replayed webhook / event)
  const res2 = await sendWhatsAppMessage({
    recipientPhone: '918320594829',
    templateKey: 'edkl_registration_received_v1',
    languageCode: 'en_US',
    variables: {
      customerName: 'Test Rajesh & Pooja',
      eventName: 'Ek Duje Ke Liye Test Seminar',
      registrationId: 'EK01-02',
      eventDate: '15 September 2026',
      eventTime: '8:30 PM',
      venue: 'Sardar Smruti Bhavan, Surat',
      statusText: 'Pending Payment'
    },
    idempotencyKey: testIdempotencyKey,
    inquiryId: testInquiryId,
    trigger: 'test_phase_a',
    executionSource: 'AUTOMATED_TEST',
    providerMode: 'MOCK'
  });

  console.log(`✓ Second Call Result: Status ${res2.status}, Deduplicated: ${res2.deduplicated ? 'YES' : 'NO'}`);

  const totalInDb = await WhatsappMessage.countDocuments({ inquiryId: testInquiryId });
  console.log(`✓ Total records in DB: ${totalInDb} (Expected: 1)`);

  const isIdempotent = totalInDb === 1;

  if (isIdempotent) {
    passed++;
  } else {
    failed++;
  }

  // Scoped Cleanup
  await WhatsappMessage.deleteMany({ inquiryId: testInquiryId });
  await mongoose.disconnect();

  console.log('\n=========================================');
  console.log('PHASE A AUDIT REPORT:');
  console.log(`WHATSAPP WABA ID: ${config.wabaIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`WHATSAPP PHONE NUMBER ID: ${config.phoneIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`PRODUCTION ACCESS TOKEN: ${config.tokenConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`WEBHOOK VERIFICATION: ${config.webhookConfigured ? 'PASS' : 'FAIL'}`);
  console.log(`PHONE NORMALIZATION: ${normPass ? 'PASS' : 'FAIL'}`);
  console.log(`MESSAGE LEDGER IDEMPOTENCY: ${isIdempotent ? 'PASS' : 'FAIL'}`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhaseATests().catch((err) => {
  console.error('[FATAL PHASE A ERROR]', err);
  process.exit(1);
});
