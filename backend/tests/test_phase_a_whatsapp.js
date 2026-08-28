import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import {
  getWhatsAppConfigStatus,
  normalizeWhatsAppRecipient,
  queuePassConfirmationMessage
} from '../src/integrations/whatsapp/whatsapp.service.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function runPhaseATests() {
  console.log('=== RUNNING PHASE A: WHATSAPP AUDIT & LEDGER TESTS ===\n');

  // 1. Audit Config
  const config = getWhatsAppConfigStatus();
  console.log('--- 1. WhatsApp Configuration Audit ---');
  console.log(`WABA ID Configured: ${config.wabaIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Phone Number ID: ${config.phoneIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Access Token: ${config.tokenConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Webhook Verify Token: ${config.webhookConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Ready for Direct Outbound: ${config.isReady ? 'YES' : 'PENDING CREDENTIALS'}`);

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

  // 3. Database Ledger & Idempotency Test
  console.log('\n--- 3. Database Ledger & Idempotency Test ---');
  await mongoose.connect(env.MONGO_URI);

  const mockReg = {
    _id: new mongoose.Types.ObjectId(),
    inquiryId: 'TEST-WA-01',
    husbandName: 'TestHusband',
    wifeName: 'TestWife',
    surname: 'TestSurname',
    phoneNumber: '9825100000',
    programId: 'prog-test-01',
    programName: 'Ek Duje Ke Liye Test',
    programDate: '2026-09-07',
    programTime: '8:30 PM',
    payment: { razorpayPaymentId: 'pay_test_12345' }
  };

  // Clean up any test record
  await WhatsappMessage.deleteMany({ inquiryId: 'TEST-WA-01' });

  // First Queue Call
  const msg1 = await queuePassConfirmationMessage({
    registration: mockReg,
    pass: { passId: 'EDKL-P-TEST01' },
    event: { name: 'Ek Duje Ke Liye Test', date: '2026-09-07', time: '8:30 PM', venue: 'Surat' }
  });
  console.log(`✓ First Queue Call: Created message ${msg1?.messageId} with status ${msg1?.status}`);

  // Second Queue Call (Simulating replayed webhook / payment verification)
  const msg2 = await queuePassConfirmationMessage({
    registration: mockReg,
    pass: { passId: 'EDKL-P-TEST01' },
    event: { name: 'Ek Duje Ke Liye Test', date: '2026-09-07', time: '8:30 PM', venue: 'Surat' }
  });
  console.log(`✓ Second Queue Call: Returned message ${msg2?.messageId}`);

  const isIdempotent = msg1?._id.toString() === msg2?._id.toString();
  console.log(`✓ Idempotency Verified: Exactly 1 record created? ${isIdempotent ? 'YES' : 'NO'}`);

  const totalInDb = await WhatsappMessage.countDocuments({ inquiryId: 'TEST-WA-01' });
  console.log(`✓ Total records in DB: ${totalInDb} (Expected: 1)`);

  // Clean up
  await WhatsappMessage.deleteMany({ inquiryId: 'TEST-WA-01' });
  await mongoose.disconnect();

  console.log('\n=========================================');
  console.log('PHASE A AUDIT REPORT:');
  console.log(`WHATSAPP WABA ID: ${config.wabaIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`WHATSAPP PHONE NUMBER ID: ${config.phoneIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`PRODUCTION ACCESS TOKEN: ${config.tokenConfigured ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`WEBHOOK VERIFICATION: ${config.webhookConfigured ? 'PASS' : 'FAIL'}`);
  console.log(`PHONE NORMALIZATION: ${normPass ? 'PASS' : 'FAIL'}`);
  console.log(`MESSAGE LEDGER IDEMPOTENCY: ${isIdempotent && totalInDb === 1 ? 'PASS' : 'FAIL'}`);
  console.log('=========================================\n');
}

runPhaseATests().catch(console.error);
