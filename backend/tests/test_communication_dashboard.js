import mongoose from 'mongoose';
import http from 'http';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';
import { Pass } from '../src/models/Pass.js';
import { Event } from '../src/models/Event.js';

async function runDashboardTests() {
  console.log('================================================================');
  console.log('EDKL — WHATSAPP COMMUNICATION DASHBOARD TEST SUITE');
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
  const authHeaders = { 'Authorization': `Bearer ${env.SUPER_ADMIN_PASSWORD}` };

  const testEventId = `prog-test-dash-${Date.now().toString().slice(-4)}`;
  const inqPaid = `TEST-DASH-PAID-${Date.now().toString().slice(-4)}`;
  const inqUnpaid = `TEST-DASH-UNP-${Date.now().toString().slice(-4)}`;
  const inqOptOut = `TEST-DASH-OPT-${Date.now().toString().slice(-4)}`;

  try {
    // -------------------------------------------------------------
    // Setup Test Data
    // -------------------------------------------------------------
    const testEvent = await Event.create({
      id: testEventId,
      name: 'Communication Dashboard Seminar',
      city: 'Surat',
      venue: 'Sardar Smruti Bhavan',
      date: '2026-09-30',
      time: '8:30 PM',
      capacity: 500,
      price: 1500,
      status: 'upcoming'
    });

    // Registration 1: Paid, Attended, WhatsApp Opt-in
    const regPaid = await Registration.create({
      inquiryId: inqPaid,
      husbandName: 'Rajesh',
      wifeName: 'Pooja',
      surname: 'Shah',
      phoneNumber: '918320594829',
      programId: testEventId,
      status: 'approved',
      payment: { status: 'captured', amount: 1500 },
      attendance: 'PRESENT',
      whatsappOptIn: true
    });

    await Pass.create({
      passId: `EDKL-P-DASH-01`,
      eventId: testEventId,
      registrationId: regPaid._id,
      inquiryId: inqPaid,
      status: 'ACTIVE',
      qrToken: 'eyJhbGciOiJFZDI1NTE5In0.dash.sig',
      keyId: 'edkl-k1'
    });

    // Messages for Reg 1
    const msgM1 = await WhatsappMessage.create({
      messageId: `WA-DASH-M1-${Date.now()}`,
      eventId: testEventId,
      registrationId: regPaid._id,
      inquiryId: inqPaid,
      recipientPhone: '918320594829',
      templateName: 'edkl_registration_received_v1',
      messageType: 'registration_received',
      trigger: 'registration',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK',
      idempotencyKey: `DASH:${inqPaid}:M1`,
      status: 'READ',
      sentAt: new Date(Date.now() - 100000),
      deliveredAt: new Date(Date.now() - 90000),
      readAt: new Date(Date.now() - 80000)
    });

    const msgM3 = await WhatsappMessage.create({
      messageId: `WA-DASH-M3-${Date.now()}`,
      eventId: testEventId,
      registrationId: regPaid._id,
      inquiryId: inqPaid,
      recipientPhone: '918320594829',
      templateName: 'edkl_payment_confirmed_pass_v1',
      messageType: 'payment_confirmation',
      trigger: 'payment_success',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK',
      idempotencyKey: `DASH:${inqPaid}:M3`,
      status: 'DELIVERED',
      sentAt: new Date(Date.now() - 70000),
      deliveredAt: new Date(Date.now() - 60000)
    });

    // Registration 2: Unpaid Pending with 1 Failed Reminder
    const regUnpaid = await Registration.create({
      inquiryId: inqUnpaid,
      husbandName: 'Karan',
      wifeName: 'Simran',
      surname: 'Verma',
      phoneNumber: '919876543210',
      programId: testEventId,
      status: 'pending',
      payment: { status: 'failed', amount: 1500 },
      attendance: 'unmarked',
      whatsappOptIn: true,
      paymentReminder: { count: 1, nextReminderAt: new Date(Date.now() + 3600000) }
    });

    const msgRemFail = await WhatsappMessage.create({
      messageId: `WA-DASH-REM-${Date.now()}`,
      eventId: testEventId,
      registrationId: regUnpaid._id,
      inquiryId: inqUnpaid,
      recipientPhone: '919876543210',
      templateName: 'edkl_payment_pending_v1',
      messageType: 'payment_pending',
      trigger: 'payment_reminder',
      executionSource: 'AUTOMATED_TEST',
      providerMode: 'MOCK',
      idempotencyKey: `DASH:${inqUnpaid}:REM1`,
      status: 'FAILED',
      lastErrorCode: '131026',
      lastErrorMessage: 'Message failed to deliver',
      failedAt: new Date()
    });

    // Registration 3: Opted Out
    const regOptOut = await Registration.create({
      inquiryId: inqOptOut,
      husbandName: 'Vikram',
      wifeName: 'Anjali',
      surname: 'Mehta',
      phoneNumber: '919988776655',
      programId: testEventId,
      status: 'inquiry',
      whatsappOptIn: false
    });

    // -------------------------------------------------------------
    // TEST 1: Event Communication Overview API
    // -------------------------------------------------------------
    console.log('--- TEST 1: Event Communication Overview API ---');
    const resOverview = await fetch(`${baseUrl}/api/whatsapp/dashboard/events/${testEventId}`, { headers: authHeaders });
    const dataOverview = await resOverview.json();

    assert(resOverview.status === 200, 'Overview endpoint returns 200 OK');
    assert(dataOverview.summary.totalRegistrations === 3, 'Total registrations count is 3');
    assert(dataOverview.summary.confirmedRegistrations === 1, 'Confirmed registrations count is 1');
    assert(dataOverview.summary.paymentPendingRegistrations === 2, 'Pending registrations count is 2');
    assert(dataOverview.summary.whatsappOptIn === 2, 'WhatsApp opt-in count is 2');
    assert(dataOverview.summary.whatsappOptOut === 1, 'WhatsApp opt-out count is 1');
    assert(dataOverview.summary.totalMessagesSent === 2, 'Total sent messages is 2 (1 Read + 1 Delivered)');
    assert(dataOverview.summary.totalMessagesDelivered === 2, 'Total delivered messages is 2');
    assert(dataOverview.summary.totalMessagesRead === 1, 'Total read messages is 1');
    assert(dataOverview.summary.totalMessagesFailed === 1, 'Total failed messages is 1');
    assert(dataOverview.summary.actionNeededCount === 1, 'Action needed count is 1 (Unpaid with failed message)');

    // -------------------------------------------------------------
    // TEST 2: Per-Message Type Stats
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Per-Message Type Breakdown Stats ---');
    const stats = dataOverview.messageTypeStats;
    assert(stats.registration_received.sent === 1 && stats.registration_received.read === 1, 'Registration received has 1 read');
    assert(stats.payment_confirmation.sent === 1 && stats.payment_confirmation.delivered === 1, 'Payment confirmation has 1 delivered');
    assert(stats.payment_pending.failed === 1, 'Payment pending has 1 failed');

    // -------------------------------------------------------------
    // TEST 3: Per-Person Registration Communication List API
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Per-Person Communication Table API ---');
    const resList = await fetch(`${baseUrl}/api/whatsapp/dashboard/events/${testEventId}/registrations?page=1&limit=10`, { headers: authHeaders });
    const dataList = await resList.json();

    assert(resList.status === 200, 'Registrations list returns 200 OK');
    assert(dataList.pagination.total === 3, 'Total items in pagination is 3');
    assert(dataList.rows.length === 3, 'Rows length is 3');

    const rowPaid = dataList.rows.find(r => r.inquiryId === inqPaid);
    assert(rowPaid.paymentStatus === 'PAID', 'Paid row has status PAID');
    assert(rowPaid.passStatus === 'ACTIVE', 'Paid row has passStatus ACTIVE');
    assert(rowPaid.messages.registration.status === 'READ', 'Paid row registration message is READ');
    assert(rowPaid.messages.paymentConfirmed.status === 'DELIVERED', 'Paid row payment confirmation is DELIVERED');
    assert(rowPaid.health === 'HEALTHY', 'Paid row health is HEALTHY');

    const rowUnpaid = dataList.rows.find(r => r.inquiryId === inqUnpaid);
    assert(rowUnpaid.paymentStatus === 'FAILED', 'Unpaid row payment status is FAILED');
    assert(rowUnpaid.messages.paymentReminder.count === 1, 'Unpaid reminder count is 1');
    assert(rowUnpaid.messages.paymentReminder.status === 'FAILED', 'Unpaid reminder status is FAILED');
    assert(rowUnpaid.messages.paymentConfirmed.reasonIfMissing === 'PAYMENT_NOT_COMPLETE', 'Payment confirmation reason is PAYMENT_NOT_COMPLETE');
    assert(rowUnpaid.health === 'ACTION_NEEDED', 'Unpaid row with failed reminder has health ACTION_NEEDED');

    const rowOptOut = dataList.rows.find(r => r.inquiryId === inqOptOut);
    assert(rowOptOut.messages.registration.reasonIfMissing === 'WHATSAPP_OPT_OUT', 'Opted out row reason is WHATSAPP_OPT_OUT');

    // -------------------------------------------------------------
    // TEST 4: Search & Filters
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Search & Filters ---');
    const resSearch = await fetch(`${baseUrl}/api/whatsapp/dashboard/events/${testEventId}/registrations?search=Rajesh`, { headers: authHeaders });
    const dataSearch = await resSearch.json();
    assert(dataSearch.rows.length === 1 && dataSearch.rows[0].inquiryId === inqPaid, 'Search by name returns exactly matching couple');

    const resFilterFailed = await fetch(`${baseUrl}/api/whatsapp/dashboard/events/${testEventId}/registrations?health=ACTION_NEEDED`, { headers: authHeaders });
    const dataFilterFailed = await resFilterFailed.json();
    assert(dataFilterFailed.rows.length === 1 && dataFilterFailed.rows[0].inquiryId === inqUnpaid, 'Filter by ACTION_NEEDED returns failing row');

    // -------------------------------------------------------------
    // TEST 5: Person Communication Timeline API
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Person Communication Timeline API ---');
    const resTimeline = await fetch(`${baseUrl}/api/whatsapp/timeline/${inqPaid}`, { headers: authHeaders });
    const dataTimeline = await resTimeline.json();
    assert(resTimeline.status === 200, 'Timeline endpoint returns 200 OK');
    assert(dataTimeline.totals.delivered === 2, 'Timeline totals delivered is 2');
    assert(dataTimeline.totals.read === 1, 'Timeline totals read is 1');
    assert(dataTimeline.timeline.length === 2, 'Timeline has 2 message items');

    // -------------------------------------------------------------
    // TEST 6: Broadcast Preview & Audience Safety
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Broadcast Audience Preview ---');
    const resBcastPrev = await fetch(`${baseUrl}/api/whatsapp/broadcasts/preview`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: testEventId, audience: 'ALL_CONFIRMED' })
    });
    const dataBcastPrev = await resBcastPrev.json();
    assert(resBcastPrev.status === 200, 'Broadcast preview returns 200 OK');
    assert(dataBcastPrev.eligibleCount === 1, 'Eligible count for ALL_CONFIRMED is 1');

    // -------------------------------------------------------------
    // Clean up test fixtures
    // -------------------------------------------------------------
    await Registration.deleteMany({ programId: testEventId });
    await Pass.deleteMany({ eventId: testEventId });
    await WhatsappMessage.deleteMany({ eventId: testEventId });
    await Event.deleteMany({ id: testEventId });

    console.log('\n================================================================');
    console.log(`DASHBOARD RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runDashboardTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
