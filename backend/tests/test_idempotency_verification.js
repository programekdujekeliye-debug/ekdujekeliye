/**
 * EDKL WhatsApp Message Idempotency Verification Test
 * Asserts that queuing duplicate messages results in exactly 1 logical record, and cleans up cleanly.
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function runIdempotencyTest() {
  console.log('=== RUNNING WHATSAPP IDEMPOTENCY REGRESSION TEST ===\n');
  await mongoose.connect(env.MONGO_URI);

  const testInquiryId = `TEST-IDEMP-${Date.now()}`;
  const testIdempotencyKey = `REMINDER_24H:prog-test-idemp:${testInquiryId}`;

  let passed = 0;
  let failed = 0;

  try {
    // First Call
    const res1 = await sendUtilityTemplate({
      recipientPhone: '918320594829', // Allowlisted test number
      templateKey: 'edkl_event_reminder_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Test Couple',
        eventName: 'Ek Duje Ke Liye Test',
        eventDate: '15 September 2026',
        eventTime: '8:30 PM',
        venue: 'Sardar Smruti Bhavan, Surat',
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: testIdempotencyKey,
      inquiryId: testInquiryId,
      trigger: 'reminder_24h',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });

    console.log(`✓ First Queue Call: status=${res1.status}, providerMessageId=${res1.providerMessageId || 'N/A'}`);

    // Second Call (Replayed trigger / duplicate event)
    const res2 = await sendUtilityTemplate({
      recipientPhone: '918320594829',
      templateKey: 'edkl_event_reminder_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Test Couple',
        eventName: 'Ek Duje Ke Liye Test',
        eventDate: '15 September 2026',
        eventTime: '8:30 PM',
        venue: 'Sardar Smruti Bhavan, Surat',
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: testIdempotencyKey,
      inquiryId: testInquiryId,
      trigger: 'reminder_24h',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });

    console.log(`✓ Second Queue Call: status=${res2.status}, deduplicated=${res2.deduplicated ? 'YES' : 'NO'}`);

    const count = await WhatsappMessage.countDocuments({ inquiryId: testInquiryId });
    console.log(`✓ Total Records in DB for ${testInquiryId}: ${count} (Expected: 1)`);

    if (count === 1 && (res2.deduplicated || res2.status === 'ALREADY_SENT')) {
      console.log('✓ PASS: WhatsApp message idempotency strictly enforced.');
      passed++;
    } else {
      console.error('❌ FAIL: Duplicate message was created or not deduplicated.');
      failed++;
    }
  } finally {
    // Unconditional Cleanup
    await WhatsappMessage.deleteMany({ inquiryId: testInquiryId });
    await mongoose.disconnect();
  }

  console.log('\n=========================================');
  console.log(`IDEMPOTENCY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIdempotencyTest().catch(err => {
  console.error('Fatal idempotency test error:', err);
  process.exit(1);
});
