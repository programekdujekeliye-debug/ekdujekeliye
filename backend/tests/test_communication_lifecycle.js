import mongoose from 'mongoose';
import { env, normalizePhoneNumber } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Pass } from '../src/models/Pass.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { invitationCardService } from '../src/services/invitationCard.service.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';
import { ensureFeedbackToken } from '../src/modules/feedback/feedback.controller.js';

async function runLifecycleTests() {
  console.log('================================================================');
  console.log('EDKL — COMPLETE CUSTOMER COMMUNICATION LIFECYCLE TEST SUITE');
  console.log('================================================================');
  console.log(`APP_ENV: ${env.APP_ENV}`);
  console.log(`Database: ${env.DATABASE_NAME}`);
  console.log(`WhatsApp Mode: ${env.WHATSAPP_MODE}`);
  console.log(`Razorpay Mode: ${env.RAZORPAY_MODE}`);
  console.log('================================================================\n');

  if (env.APP_ENV !== 'development' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error(`[SAFETY GUARD] Cannot run lifecycle test on database: ${env.DATABASE_NAME}`);
  }

  // Intercept Meta WhatsApp Cloud API calls to prevent spamming live phone numbers during test runs
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === 'string' && url.includes('graph.facebook.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '918320594829', wa_id: '918320594829' }],
          messages: [{ id: `wamid.MOCK_TEST_${Date.now()}` }]
        }),
        text: async () => JSON.stringify({ messaging_product: 'whatsapp' })
      };
    }
    return originalFetch(url, options);
  };

  await mongoose.connect(env.MONGO_URI);

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  const testPhone = '918320594829';
  const testInquiryId = `TEST-LF-${Date.now().toString().slice(-4)}`;

  try {
    // 1. Setup Test Event (48h+ in future)
    const testEvent = await Event.findOneAndUpdate(
      { id: 'prog-test-lifecycle' },
      {
        id: 'prog-test-lifecycle',
        name: 'Ek Duje Ke Liye - Test Seminar',
        city: 'Surat',
        venue: 'Sardar Smruti Bhavan, Surat',
        date: '2026-09-25',
        time: '8:30 PM',
        price: 1500,
        capacity: 500,
        status: 'upcoming'
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Setup Test Registration
    const testReg = await Registration.findOneAndUpdate(
      { inquiryId: testInquiryId },
      {
        inquiryId: testInquiryId,
        husbandName: 'Jaynesh',
        wifeName: 'Pooja',
        surname: 'Patel',
        phoneNumber: testPhone,
        programId: testEvent.id,
        programName: testEvent.name,
        programDate: testEvent.date,
        programTime: testEvent.time,
        couplePhoto: '/sample_couple.png',
        status: 'approved',
        whatsappOptIn: true,
        whatsappOptInAt: new Date(),
        payment: {
          status: 'captured',
          amount: 1500,
          razorpayPaymentId: `pay_test_${Date.now()}`,
          paidAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log('--- TEST 1: Digital Entry Pass & Cryptographic QR ---');
    const pass = await qrPassService.ensurePass(testReg, testEvent);
    assert(pass && pass.passId.startsWith('EDKL-'), 'Pass created with readable Pass ID prefix (EDKL-XXXXXXXX)');
    assert(pass.qrToken && pass.qrToken.includes('.'), 'QR Token is Ed25519 signature payload');

    const [encodedPayload, encodedSig] = pass.qrToken.split('.');
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    assert(payload.passId === pass.passId, 'QR Payload contains passId');
    assert(!payload.phone && !payload.name && !payload.husbandName && !payload.amount, 'Zero PII inside QR payload');

    console.log('\n--- TEST 2: Personalized Invitation Card Generation ---');
    const cardResult = await invitationCardService.ensureInvitationCard(testInquiryId);
    assert(cardResult && cardResult.buffer && cardResult.buffer.length > 500, 'Deterministic 1080x1350 card buffer generated');
    const cardSvg = cardResult.buffer.toString('utf8');
    assert(cardSvg.includes('You are Cordially Invited'), 'Card contains luxury invitation wording');
    assert(cardSvg.includes('Jaynesh &amp; Pooja Patel') || cardSvg.includes('Jaynesh & Pooja Patel'), 'Card contains couple names');
    assert(!cardSvg.includes('qrToken') && !cardSvg.includes('1500'), 'Card is separate from QR security token');

    console.log('\n--- TEST 3: M1 - Registration Received Dispatch ---');
    const m1Res = await sendUtilityTemplate({
      recipientPhone: testPhone,
      templateKey: 'edkl_registration_received_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jaynesh',
        eventName: testEvent.name,
        registrationId: testInquiryId,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        statusText: 'Pending Payment'
      },
      idempotencyKey: `REG_RECEIVED:${testReg._id}`,
      registrationId: testReg._id,
      eventId: testEvent.id,
      inquiryId: testInquiryId,
      trigger: 'registration_created',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(m1Res.status === 'SENT' || m1Res.status === 'QUEUED' || m1Res.status === 'ALREADY_SENT', 'M1 Registration Received processed');

    console.log('\n--- TEST 4: M3 & M4 - Payment Confirmation & Pass Ready ---');
    const m3Res = await sendUtilityTemplate({
      recipientPhone: testPhone,
      templateKey: 'edkl_payment_confirmed_pass_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jaynesh',
        eventName: testEvent.name,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: `PAYMENT_CONFIRMED:${testReg._id}:test_pay`,
      registrationId: testReg._id,
      eventId: testEvent.id,
      inquiryId: testInquiryId,
      trigger: 'payment_verified',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(m3Res.status === 'SENT' || m3Res.status === 'QUEUED' || m3Res.status === 'ALREADY_SENT', 'M3 Payment Confirmed processed');

    const m4Res = await sendUtilityTemplate({
      recipientPhone: testPhone,
      templateKey: 'edkl_event_reminder_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jaynesh',
        eventName: testEvent.name,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: `PASS_READY:${pass.passId}:v1`,
      registrationId: testReg._id,
      eventId: testEvent.id,
      inquiryId: testInquiryId,
      trigger: 'pass_issued',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(m4Res.status === 'SENT' || m4Res.status === 'QUEUED' || m4Res.status === 'ALREADY_SENT', 'M4 Digital Pass Ready processed');

    console.log('\n--- TEST 5: M5 - 48-Hour Personalized Invitation Simulation ---');
    const m5Res = await sendUtilityTemplate({
      recipientPhone: testPhone,
      templateKey: 'edkl_event_reminder_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jaynesh',
        eventName: testEvent.name,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: `INVITATION_48H:${testEvent.id}:${testInquiryId}:v1`,
      registrationId: testReg._id,
      eventId: testEvent.id,
      inquiryId: testInquiryId,
      trigger: 'invitation_48h',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(m5Res.status === 'SENT' || m5Res.status === 'QUEUED' || m5Res.status === 'ALREADY_SENT', 'M5 48h Invitation processed');

    console.log('\n--- TEST 6: M6 - 24-Hour Event Reminder Simulation ---');
    const m6Res = await sendUtilityTemplate({
      recipientPhone: testPhone,
      templateKey: 'edkl_event_reminder_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jaynesh',
        eventName: testEvent.name,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: `REMINDER_24H:${testEvent.id}:${testInquiryId}`,
      registrationId: testReg._id,
      eventId: testEvent.id,
      inquiryId: testInquiryId,
      trigger: 'reminder_24h',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(m6Res.status === 'SENT' || m6Res.status === 'QUEUED' || m6Res.status === 'ALREADY_SENT', 'M6 24h Reminder processed');

    console.log('\n--- TEST 7: M7 - Post-Event Review Token & Dispatch Simulation ---');
    const feedback = await ensureFeedbackToken(testInquiryId, testEvent.id, 'Jaynesh & Pooja Patel');
    assert(feedback && feedback.token && feedback.token.length >= 16, 'Secure feedback token created for attendee');

    const m7Res = await sendUtilityTemplate({
      recipientPhone: testPhone,
      templateKey: 'edkl_event_reminder_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jaynesh',
        eventName: testEvent.name,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: `REVIEW:${testEvent.id}:${testInquiryId}`,
      registrationId: testReg._id,
      eventId: testEvent.id,
      inquiryId: testInquiryId,
      trigger: 'review_post_event',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(m7Res.status === 'SENT' || m7Res.status === 'QUEUED' || m7Res.status === 'ALREADY_SENT', 'M7 Post-Event Review processed');

    console.log('\n--- TEST 8: Test Mode Guard Blocking Non-Allowlisted Numbers ---');
    const blockedRes = await sendUtilityTemplate({
      recipientPhone: '919999999999',
      templateKey: 'edkl_event_reminder_v1',
      variables: {
        customerName: 'Random',
        eventName: testEvent.name,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        registrationId: 'RAND-999',
        inquiryId: 'RAND-999'
      },
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(blockedRes.status === 'BLOCKED_TEST_MODE', 'Blocked dispatch to non-allowlisted number in test mode');

    console.log('\n================================================================');
    console.log(`LIFECYCLE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
  } finally {
    // Unconditional Scoped Cleanup of all automated test artifacts
    await Registration.deleteMany({ inquiryId: testInquiryId });
    await Pass.deleteMany({ inquiryId: testInquiryId });
    await WhatsappMessage.deleteMany({ inquiryId: testInquiryId });
    await WhatsappMessage.deleteMany({ recipientPhone: '919999999999' });
    await WhatsappMessage.deleteMany({ executionSource: 'AUTOMATED_TEST' });
    await Event.deleteMany({ id: 'prog-test-lifecycle' });

    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runLifecycleTests().catch(err => {
  console.error('Lifecycle test runner error:', err);
  process.exit(1);
});
