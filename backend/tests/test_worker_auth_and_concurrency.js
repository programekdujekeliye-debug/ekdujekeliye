import mongoose from 'mongoose';
import http from 'http';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';
import { Pass } from '../src/models/Pass.js';
import { Event } from '../src/models/Event.js';
import { communicationSchedulerService } from '../src/services/communicationScheduler.service.js';

async function runWorkerTests() {
  console.log('================================================================');
  console.log('EDKL — CLOUD WORKER AUTH & ATOMIC CLAIM CONCURRENCY TEST SUITE');
  console.log('================================================================\n');

  if (env.APP_ENV !== 'development' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error(`[SAFETY GUARD] Cannot run test on database: ${env.DATABASE_NAME}`);
  }

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

  // Spin up temporary local HTTP server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------
    // 1. Worker Auth Tests
    // -------------------------------------------------------------
    console.log('--- TEST 1: Worker Auth Verification ---');

    // 1a. Missing cron secret
    const resNoAuth = await fetch(`${baseUrl}/api/whatsapp/run-worker`, { method: 'POST' });
    assert(resNoAuth.status === 403 || resNoAuth.status === 401, 'No auth header returns 401/403');

    // 1b. Wrong cron secret
    const resWrongSecret = await fetch(`${baseUrl}/api/whatsapp/run-worker`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret-12345' }
    });
    assert(resWrongSecret.status === 403, 'Wrong x-cron-secret returns 403 Forbidden');

    // 1c. Super Admin password as Bearer on machine cron endpoint (MUST BE REJECTED)
    const resAdminAsCron = await fetch(`${baseUrl}/api/whatsapp/run-worker`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SUPER_ADMIN_PASSWORD}` }
    });
    assert(resAdminAsCron.status === 403 || resAdminAsCron.status === 401, 'Super Admin password on /run-worker is REJECTED');

    // 1d. Valid x-cron-secret
    const resValidCron = await fetch(`${baseUrl}/api/whatsapp/run-worker`, {
      method: 'POST',
      headers: { 'x-cron-secret': env.CRON_SECRET || 'dev_cron_secret_test' }
    });
    assert(resValidCron.status === 200, 'Valid x-cron-secret on /run-worker is ACCEPTED');

    // 1e. Human Super Admin route /run-worker-admin
    const resAdminManual = await fetch(`${baseUrl}/api/whatsapp/run-worker-admin`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SUPER_ADMIN_PASSWORD}` }
    });
    assert(resAdminManual.status === 200, 'Super Admin session on /run-worker-admin is ACCEPTED');

    // -------------------------------------------------------------
    // 2. Atomic Claim Concurrency Test
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Atomic Claim Concurrency Test ---');

    const testInquiryId = `TEST-CONC-${Date.now().toString().slice(-4)}`;
    const testEventId = `prog-test-conc-${Date.now().toString().slice(-4)}`;

    const testEvent = await Event.create({
      id: testEventId,
      name: 'Concurrency Test Seminar',
      city: 'Surat',
      venue: 'Sardar Smruti Bhavan',
      date: '2026-09-25',
      time: '8:30 PM',
      capacity: 500,
      price: 1500,
      status: 'upcoming'
    });

    const testReg = await Registration.create({
      inquiryId: testInquiryId,
      husbandName: 'Amit',
      wifeName: 'Neha',
      surname: 'Patel',
      phoneNumber: '918320594829',
      programId: testEvent.id,
      status: 'approved',
      whatsappOptIn: true
    });

    await Pass.create({
      passId: `EDKL-P-CONC-${Date.now()}`,
      eventId: testEvent.id,
      registrationId: testReg._id,
      inquiryId: testInquiryId,
      status: 'ACTIVE',
      qrToken: 'eyJhbGciOiJFZDI1NTE5In0.test.sig',
      keyId: 'edkl-k1'
    });

    // Create exactly one QUEUED message due right now
    const testMsg = await WhatsappMessage.create({
      messageId: `WA-CONC-${Date.now()}`,
      eventId: testEvent.id,
      registrationId: testReg._id,
      inquiryId: testInquiryId,
      recipientPhone: '918320594829',
      recipientMasked: '918320****29',
      templateName: 'edkl_event_reminder_v1',
      templateLanguage: 'en_US',
      templateCategory: 'UTILITY',
      messageType: 'reminder',
      trigger: 'concurrency_test',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK',
      idempotencyKey: `CONC_TEST:${testInquiryId}`,
      status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
      scheduledFor: new Date(Date.now() - 10000), // Due in the past
      templateParameters: {
        customerName: 'Amit & Neha',
        eventName: testEvent.name,
        eventDate: testEvent.date,
        eventTime: testEvent.time,
        venue: testEvent.venue,
        registrationId: testInquiryId,
        inquiryId: testInquiryId
      }
    });

    // Launch two worker claims simultaneously on the same due job
    const [workerA, workerB] = await Promise.all([
      communicationSchedulerService.processScheduledJobs({ ignoreLock: true }),
      communicationSchedulerService.processScheduledJobs({ ignoreLock: true })
    ]);

    const totalProcessed = workerA.processed + workerB.processed;
    assert(totalProcessed === 1, `Exactly 1 claim across concurrent workers (Worker A: ${workerA.processed}, Worker B: ${workerB.processed})`);

    const updatedMsg = await WhatsappMessage.findById(testMsg._id);
    assert(updatedMsg.status === 'SENT' || updatedMsg.status === 'QUEUED', 'Job state cleanly finalized');

    // -------------------------------------------------------------
    // Clean up
    // -------------------------------------------------------------
    await Registration.deleteMany({ inquiryId: testInquiryId });
    await Pass.deleteMany({ inquiryId: testInquiryId });
    await WhatsappMessage.deleteMany({ inquiryId: testInquiryId });
    await Event.deleteMany({ id: testEventId });

    console.log('\n================================================================');
    console.log(`WORKER & CONCURRENCY RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkerTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
