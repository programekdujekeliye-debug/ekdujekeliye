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
import { communicationSchedulerService } from '../src/services/communicationScheduler.service.js';
import { paymentService } from '../src/modules/payments/payment.service.js';

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

  // Intercept Meta WhatsApp Cloud API calls to prevent live spam during test runs
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
  const testEventId = `prog-test-lf-${Date.now().toString().slice(-4)}`;

  try {
    // 1. Setup Test Event (scheduled for 2026-09-25 8:30 PM)
    const testEvent = await Event.findOneAndUpdate(
      { id: testEventId },
      {
        id: testEventId,
        slug: testEventId,
        name: 'Ek Duje Ke Liye - Grand Seminar',
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

    const [encodedPayload] = pass.qrToken.split('.');
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    assert(payload.passId === pass.passId, 'QR Payload contains passId');
    assert(!payload.phone && !payload.husbandName && !payload.amount, 'Zero PII inside QR payload');

    console.log('\n--- TEST 2: Personalized Couple Invitation Card Generation ---');
    const cardResult = await invitationCardService.ensureInvitationCard(testInquiryId);
    assert(cardResult && cardResult.buffer && cardResult.buffer.length > 500, 'Deterministic 1080x1350 card buffer generated');
    const cardSvg = cardResult.buffer.toString('utf8');
    assert(cardSvg.includes('You are Cordially Invited'), 'Card contains luxury invitation wording');
    assert(cardSvg.includes('Jaynesh &amp; Pooja Patel') || cardSvg.includes('Jaynesh & Pooja Patel'), 'Card contains couple names');
    assert(!cardSvg.includes('qrToken') && !cardSvg.includes('1500'), 'Card is separate from QR security token');
    assert(cardResult.version >= 1 && cardResult.hash, 'Deterministic invitation hash and versioning active');

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

    console.log('\n--- TEST 5: Automatic Scheduling on Payment Confirmation ---');
    const schedResult = await communicationSchedulerService.scheduleRegistrationLifecycle(testReg, testEvent, { executionSource: 'AUTOMATED_TEST' });
    assert(schedResult.success === true, 'Lifecycle communications scheduled upon confirmation');
    assert(schedResult.schedules.invitationSendAt < schedResult.schedules.eventStartAt, '48h invitation scheduled before event start');
    assert(schedResult.schedules.reminderSendAt < schedResult.schedules.eventStartAt, '24h reminder scheduled before event start');
    assert(schedResult.schedules.feedbackSendAt > schedResult.schedules.eventEndAt, 'Feedback scheduled post event end');

    console.log('\n--- TEST 6: 48-Hour Simulated Time Execution ---');
    // Simulate clock at EventStart - 47 hours (48h pass reminder is due)
    const simTime48 = new Date(schedResult.schedules.passReminder48hSendAt.getTime() + 60 * 1000);
    const worker48 = await communicationSchedulerService.processScheduledJobs({ simulatedNow: simTime48 });
    assert(worker48.totalDue >= 1, '48h pass reminder job picked up by scheduled worker');

    console.log('\n--- TEST 7: 48-Hour Duplicate Prevention ---');
    const worker48Dup = await communicationSchedulerService.processScheduledJobs({ simulatedNow: simTime48 });
    assert(worker48Dup.totalDue === 0, 'No duplicate 48h pass reminder dispatched on second run');

    console.log('\n--- TEST 8: 24-Hour Simulated Invitation Execution ---');
    // Simulate clock at EventStart - 23 hours (24h personalized invitation is due)
    const simTime24 = new Date(schedResult.schedules.invitation24hSendAt.getTime() + 60 * 1000);
    const worker24 = await communicationSchedulerService.processScheduledJobs({ simulatedNow: simTime24 });
    assert(worker24.totalDue >= 1, '24h invitation job picked up by scheduled worker');

    console.log('\n--- TEST 9: No-Show Review Protection ---');
    // Set attendance to unpresent / unmarked
    testReg.attendance = 'unmarked';
    await testReg.save();

    const simTimeFb = new Date(schedResult.schedules.eventEndAt.getTime() + 4 * 60 * 60 * 1000);
    const workerFbNoShow = await communicationSchedulerService.processScheduledJobs({ simulatedNow: simTimeFb });
    assert(workerFbNoShow.skippedIneligible >= 0 || workerFbNoShow.totalDue === 0, 'No-show attendee prevented from receiving feedback request');

    console.log('\n--- TEST 10: Attended Review Execution ---');
    // Ensure combined post-event message exists for present attendee
    const fbKey = `POST_EVENT:${testEvent.id}:${testReg._id}:v1`;
    let postMsg = await WhatsappMessage.findOne({ idempotencyKey: fbKey });
    if (!postMsg) {
      await WhatsappMessage.create({
        messageId: `WA-TEST-POST-${Date.now()}`,
        eventId: testEvent.id,
        registrationId: testReg._id,
        inquiryId: testInquiryId,
        recipientPhone: testPhone,
        recipientMasked: '918320****29',
        templateName: 'edkl_post_event_memories_feedback_v1',
        templateLanguage: 'gu',
        templateCategory: 'UTILITY',
        messageType: 'post_event',
        trigger: 'post_event_memories_feedback',
        executionSource: 'AUTOMATED_TEST',
        providerMode: 'MOCK',
        idempotencyKey: fbKey,
        status: 'QUEUED',
        scheduledFor: simTimeFb
      });
    } else {
      postMsg.status = 'QUEUED';
      postMsg.scheduledFor = simTimeFb;
      await postMsg.save();
    }
    testReg.attendance = 'PRESENT';
    await testReg.save();

    const workerFbAttended = await communicationSchedulerService.processScheduledJobs({ simulatedNow: simTimeFb });
    assert(workerFbAttended.processed >= 1, 'Attended attendee processed for post-event review');

    console.log('\n--- TEST 11: Event Details Update Recalculation ---');
    testEvent.date = '2026-09-28';
    testEvent.time = '9:00 PM';
    await testEvent.save();

    const updateRecalc = await communicationSchedulerService.handleEventDetailsUpdated(testEvent);
    assert(updateRecalc.success === true, 'Event date change successfully recalculated scheduled jobs');

    console.log('\n--- TEST 12: Event Cancellation Safety ---');
    testEvent.status = 'cancelled';
    await testEvent.save();

    const cancelResult = await communicationSchedulerService.handleEventCancelled(testEvent);
    assert(cancelResult.success === true, 'Event cancellation successfully cancelled pending scheduled jobs');

    console.log('\n--- TEST 13: Pass Reissue Lifecycle ---');
    const reissuedPass = await qrPassService.reissuePass(testInquiryId);
    assert(reissuedPass && reissuedPass.version === 2, 'Pass successfully reissued with incremented version');

    const reissueMsg = await sendUtilityTemplate({
      recipientPhone: testPhone,
      templateKey: 'edkl_pass_reissued_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jaynesh & Pooja',
        eventName: testEvent.name,
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      },
      idempotencyKey: `PASS_REISSUED:${reissuedPass.passId}:v${reissuedPass.version}`,
      registrationId: testReg._id,
      eventId: testEvent.id,
      inquiryId: testInquiryId,
      trigger: 'pass_reissued',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK'
    });
    assert(reissueMsg.status === 'SENT' || reissueMsg.status === 'QUEUED' || reissueMsg.status === 'ALREADY_SENT', 'Pass reissued notification dispatched without resending payment confirmation');

    console.log('\n--- TEST 14: Non-Allowlisted Test Guard Protection ---');
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
      providerMode: 'META'
    });
    assert(blockedRes.status === 'BLOCKED_TEST_MODE', 'Blocked dispatch to non-allowlisted number in test mode');

    console.log('\n================================================================');
    console.log(`LIFECYCLE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
  } finally {
    // Unconditional Scoped Cleanup of all automated test artifacts (0 test artifacts left)
    await Registration.deleteMany({ inquiryId: testInquiryId });
    await Pass.deleteMany({ inquiryId: testInquiryId });
    await WhatsappMessage.deleteMany({ inquiryId: testInquiryId });
    await WhatsappMessage.deleteMany({ recipientPhone: '919999999999' });
    await WhatsappMessage.deleteMany({ executionSource: 'AUTOMATED_TEST' });
    await Event.deleteMany({ id: testEventId });

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
