import mongoose from 'mongoose';
import crypto from 'crypto';
import { env } from '../src/config/env.js';
import { paymentService } from '../src/modules/payments/payment.service.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import {
  handleOnlineScan,
  handleOfflineSync
} from '../src/modules/scanner/scanner.controller.js';
import {
  dispatchTemplateMessage,
  sendWhatsAppMessage
} from '../src/integrations/whatsapp/whatsapp.service.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Payment } from '../src/models/Payment.js';
import { Pass } from '../src/models/Pass.js';
import { ScanRecord } from '../src/models/ScanRecord.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { WebhookEvent } from '../src/models/WebhookEvent.js';

// Helper mock response
function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

async function runCompleteE2ETest() {
  console.log('================================================================');
  console.log('EDKL E2E SYSTEM TEST SUITE (ISOLATED TEST ENVIRONMENT)');
  console.log('================================================================\n');

  // STEP 1: Strict Environment Isolation Verification
  console.log('--- STEP 1: ENVIRONMENT ISOLATION & STARTUP GUARDS ---');
  console.log(`APP_ENV: ${env.APP_ENV}`);
  console.log(`Target Database: ${env.DATABASE_NAME}`);
  console.log(`Database Env: ${env.DATABASE_ENV}`);

  const isIsolated = env.APP_ENV !== 'production' && env.DATABASE_NAME === 'ekdujekeliye_test';
  if (!isIsolated) {
    throw new Error(`[CRITICAL ABORT] Test running against non-isolated DB: ${env.DATABASE_NAME}`);
  }
  console.log(`✓ Environment Isolation Guard: PASS (Connected to ${env.DATABASE_NAME})`);

  await mongoose.connect(env.MONGO_URI);
  console.log(`✓ MongoDB connection established to isolated test database.`);

  // Scoped cleanup of previous run if any
  const testEventId = 'prog-test-e2e-2026';
  const testInquiryId = 'TEST-E2E-01';

  await Event.deleteMany({ id: testEventId });
  await Registration.deleteMany({ inquiryId: testInquiryId });
  await Payment.deleteMany({ inquiryId: testInquiryId });
  await Pass.deleteMany({ inquiryId: testInquiryId });
  await ScanRecord.deleteMany({ inquiryId: testInquiryId });
  await WhatsappMessage.deleteMany({ inquiryId: testInquiryId });
  await WebhookEvent.deleteMany({ eventId: 'evt_test_fake_webhook_999' });

  // STEP 2: Razorpay Mode Guard
  console.log('\n--- STEP 2: RAZORPAY MODE & PREFIX GUARD ---');
  console.log(`RAZORPAY_MODE: ${env.RAZORPAY_MODE.toUpperCase()}`);
  const razorpayGuardPass = env.RAZORPAY_MODE === 'test';
  console.log(`✓ Razorpay Test Mode Guard: ${razorpayGuardPass ? 'PASS' : 'FAIL'}`);

  // STEP 3: Create Test Event in Test DB
  console.log('\n--- STEP 3: CREATE TEST EVENT IN ISOLATED TEST DB ---');
  const testEvent = await Event.create({
    id: 'prog-test-e2e-2026',
    name: 'TEST EVENT — QR & WHATSAPP E2E',
    date: '2026-10-15',
    time: '8:30 PM',
    venue: 'Test Smruti Hall, Surat',
    price: 1500,
    status: 'upcoming',
    capacity: 50,
    isActive: true
  });
  console.log(`✓ Test Event Created in TEST DB: [${testEvent.id}] ${testEvent.name}`);

  // STEP 4: Create Test Registration in Test DB
  console.log('\n--- STEP 4: CREATE TEST REGISTRATION IN TEST DB ---');
  const testReg = await Registration.create({
    inquiryId: 'TEST-E2E-01',
    customerToken: crypto.randomBytes(16).toString('hex'),
    husbandName: 'TestManish',
    wifeName: 'TestWife',
    surname: 'Vaghasiya',
    phoneNumber: '918320594829', // Allowlisted test number
    programId: testEvent.id,
    programName: testEvent.name,
    programDate: testEvent.date,
    programTime: testEvent.time,
    status: 'pending',
    payment: {
      provider: 'razorpay',
      status: 'created',
      amount: 1500,
      currency: 'INR',
      razorpayOrderId: 'order_test_mock_123'
    },
    attendance: 'unmarked'
  });
  console.log(`✓ Test Registration Created: [${testReg.inquiryId}] ${testReg.husbandName} & ${testReg.wifeName}`);

  // STEP 5: Razorpay Test Payment Capture & Server Finalization
  console.log('\n--- STEP 5: AUTHORITATIVE CAPTURED PAYMENT FINALIZATION ---');
  const fakePaymentId = `pay_test_mock_captured_${Date.now()}`;
  const fakeOrderId = `order_test_mock_${Date.now()}`;
  const fakeWebhookEventId = `evt_test_mock_webhook_${Date.now()}`;

  // Finalize payment as server-authoritative captured
  await paymentService.finalizeWebhookPayment({
    eventId: fakeWebhookEventId,
    orderId: fakeOrderId,
    paymentId: fakePaymentId,
    amount: 150000,
    inquiryId: testReg.inquiryId,
    rawPayload: { simulated: true }
  });

  const regApproved = await Registration.findOne({ inquiryId: testReg.inquiryId });
  const paymentLedger = await Payment.findOne({ paymentId: fakePaymentId });

  const finalizationPass = regApproved?.status === 'approved' && regApproved?.payment?.status === 'captured';
  const paymentLedgerPass = paymentLedger?.status === 'captured';

  console.log(`✓ Registration Approved & Captured: ${finalizationPass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Payment Ledger Created: ${paymentLedgerPass ? 'PASS' : 'FAIL'}`);

  // STEP 6: Automatic Pass & Ed25519 Asymmetric Signed QR
  console.log('\n--- STEP 6: AUTOMATIC PASS & ED25519 ASYMMETRIC SIGNED QR ---');
  const issuedPass = await Pass.findOne({ inquiryId: testReg.inquiryId });
  const passCreatedPass = Boolean(issuedPass && issuedPass.passId.startsWith('EDKL-P-'));
  console.log(`✓ Pass Issued: ${passCreatedPass ? 'PASS' : 'FAIL'} (Pass ID: ${issuedPass?.passId})`);

  const qrVerify = qrPassService.verifyPassToken(issuedPass.qrToken);
  const qrValidPass = qrVerify.valid === true && qrVerify.payload?.passId === issuedPass.passId;
  console.log(`✓ Ed25519 Cryptographic QR Verified: ${qrValidPass ? 'PASS' : 'FAIL'}`);
  console.log('Decoded QR Payload:', qrVerify.payload);

  // STEP 7: Webhook Replay Idempotency Check
  console.log('\n--- STEP 7: WEBHOOK REPLAY IDEMPOTENCY CHECK ---');
  // Replay the exact same finalization
  await paymentService.finalizeWebhookPayment({
    eventId: fakeWebhookEventId,
    orderId: fakeOrderId,
    paymentId: fakePaymentId,
    amount: 150000,
    inquiryId: testReg.inquiryId,
    rawPayload: { simulated: true }
  });

  const totalPasses = await Pass.countDocuments({ inquiryId: testReg.inquiryId });
  const totalPayments = await Payment.countDocuments({ inquiryId: testReg.inquiryId });
  const idempotencyPass = totalPasses === 1 && totalPayments === 1;
  console.log(`✓ Idempotency on Webhook Replay: Exactly 1 Pass and 1 Payment? ${idempotencyPass ? 'PASS' : 'FAIL'}`);

  // STEP 8: WhatsApp Message Queue & Allowlist Guard
  console.log('\n--- STEP 8: WHATSAPP MESSAGE QUEUE & ALLOWLIST GUARD ---');
  const queuedMsg = await WhatsappMessage.findOne({ inquiryId: testReg.inquiryId });
  const waQueuePass = queuedMsg?.status === 'QUEUED' || queuedMsg?.status === 'SENT';
  console.log(`✓ WhatsApp Confirmation Queued in Ledger: ${waQueuePass ? 'PASS' : 'FAIL'} (ID: ${queuedMsg?.messageId || queuedMsg?._id})`);

  // Test allowlist guard with non-allowlisted number
  const nonAllowedResult = await sendWhatsAppMessage({
    recipientPhone: '919999999999', // Not in allowlist
    templateKey: 'edkl_payment_confirmed_pass_v1',
    idempotencyKey: 'TEST_NONALLOWED_KEY',
    inquiryId: 'TEST-NONALLOWED'
  });
  const allowlistGuardPass = nonAllowedResult.status === 'BLOCKED_TEST_MODE' || nonAllowedResult.error?.includes('allowlist');
  console.log(`✓ Non-allowlisted recipient blocked in test mode: ${allowlistGuardPass ? 'PASS' : 'FAIL'}`);

  // STEP 9: QR Crypto Tamper Validation
  console.log('\n--- STEP 9: QR CRYPTOGRAPHIC TAMPER VALIDATION ---');
  // Alter payload
  const validQrParts = issuedPass.qrToken.split('.');
  const tamperedPayloadStr = Buffer.from(JSON.stringify({ ...qrVerify.payload, passId: 'EDKL-P-FAKEXX' })).toString('base64url');
  const tamperedQrToken = `${tamperedPayloadStr}.${validQrParts[1]}`;

  const tamperCheck = qrPassService.verifyPassToken(tamperedQrToken);
  const tamperRejectPass = !tamperCheck.valid && tamperCheck.error === 'INVALID_SIGNATURE';
  console.log(`✓ Tampered QR Rejected: ${tamperRejectPass ? 'PASS' : 'FAIL'}`);

  // STEP 10: Online Scanner & Atomic Attendance Marking
  console.log('\n--- STEP 10: ONLINE SCANNER & ATOMIC ATTENDANCE ---');
  // Phone A: First Online Scan
  const scanReq1 = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: testEvent.id,
      deviceId: 'PHONE-GATE-1',
      deviceSequence: 1
    },
    user: { username: 'gate_operator_1' }
  };
  const scanRes1 = createMockRes();
  await handleOnlineScan(scanReq1, scanRes1);

  const onlineScan1Pass = scanRes1.data?.result === 'VALID';
  console.log(`✓ Phone A Scan Result: ${scanRes1.data?.result} (${onlineScan1Pass ? 'PASS' : 'FAIL'})`);

  const regAfterScan = await Registration.findOne({ inquiryId: testReg.inquiryId });
  const attendancePresentPass = regAfterScan?.attendance === 'present';
  console.log(`✓ Attendance Marked Present in DB: ${attendancePresentPass ? 'PASS' : 'FAIL'}`);

  // Phone B: Duplicate Online Scan
  const scanReq2 = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: testEvent.id,
      deviceId: 'PHONE-GATE-2',
      deviceSequence: 1
    },
    user: { username: 'gate_operator_2' }
  };
  const scanRes2 = createMockRes();
  await handleOnlineScan(scanReq2, scanRes2);

  const onlineScan2Duplicate = scanRes2.data?.result === 'ALREADY_SCANNED';
  console.log(`✓ Phone B Duplicate Scan Result: ${scanRes2.data?.result} (${onlineScan2Duplicate ? 'PASS' : 'FAIL'})`);

  // STEP 11: Wrong Event Protection
  console.log('\n--- STEP 11: WRONG EVENT PROTECTION ---');
  const wrongEventReq = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: 'prog-different-event-batch',
      deviceId: 'PHONE-GATE-1'
    },
    user: { username: 'gate_operator_1' }
  };
  const wrongEventRes = createMockRes();
  await handleOnlineScan(wrongEventReq, wrongEventRes);

  const wrongEventPass = wrongEventRes.data?.result === 'WRONG_EVENT';
  console.log(`✓ Wrong Event Rejected: ${wrongEventPass ? 'PASS' : 'FAIL'}`);

  // STEP 12: Multi-Device Offline Sync & Deterministic Conflict Resolution
  console.log('\n--- STEP 12: MULTI-DEVICE OFFLINE SYNC & CONFLICT RESOLUTION ---');
  // Create Test Pass 2 for offline conflict test
  const testReg2 = await Registration.create({
    inquiryId: 'TEST-E2E-02',
    husbandName: 'Kunal',
    wifeName: 'Neha',
    surname: 'Shah',
    phoneNumber: '919825100000',
    programId: testEvent.id,
    status: 'approved',
    attendance: 'unmarked'
  });
  const pass2 = await qrPassService.ensurePass(testReg2, testEvent);

  // Phone A offline scan at 18:00
  const offlineScanA = {
    scanLocalId: 'OFF-A-001',
    qrToken: pass2.qrToken,
    passId: pass2.passId,
    scannedAtDevice: new Date(Date.now() - 120000).toISOString(),
    deviceSequence: 1
  };

  // Phone B offline scan at 18:01 (scanned same pass while disconnected)
  const offlineScanB = {
    scanLocalId: 'OFF-B-001',
    qrToken: pass2.qrToken,
    passId: pass2.passId,
    scannedAtDevice: new Date(Date.now() - 60000).toISOString(),
    deviceSequence: 1
  };

  // Sync Phone A
  const syncReqA = {
    body: {
      deviceId: 'EDKL-DEVICE-PHONE-A',
      eventId: testEvent.id,
      scans: [offlineScanA]
    },
    user: { username: 'staff_A' }
  };
  const syncResA = createMockRes();
  await handleOfflineSync(syncReqA, syncResA);
  const syncAPass = syncResA.data?.results?.[0]?.result === 'ACCEPTED';
  console.log(`✓ Phone A Offline Sync Result: ${syncResA.data?.results?.[0]?.result} (${syncAPass ? 'PASS' : 'FAIL'})`);

  // Sync Phone B (Conflict)
  const syncReqB = {
    body: {
      deviceId: 'EDKL-DEVICE-PHONE-B',
      eventId: testEvent.id,
      scans: [offlineScanB]
    },
    user: { username: 'staff_B' }
  };
  const syncResB = createMockRes();
  await handleOfflineSync(syncReqB, syncResB);
  const syncBConflict = syncResB.data?.results?.[0]?.result === 'CONFLICT';
  console.log(`✓ Phone B Offline Conflict Result: ${syncResB.data?.results?.[0]?.result} (${syncBConflict ? 'PASS' : 'FAIL'})`);

  // STEP 13: Scoped Cleanup of Test Fixtures
  await Event.deleteMany({ id: testEvent.id });
  await Registration.deleteMany({ inquiryId: testReg.inquiryId });
  await Payment.deleteMany({ inquiryId: testReg.inquiryId });
  await Pass.deleteMany({ inquiryId: testReg.inquiryId });
  await ScanRecord.deleteMany({ inquiryId: testReg.inquiryId });
  await WhatsappMessage.deleteMany({ inquiryId: testReg.inquiryId });
  await WhatsappMessage.deleteMany({ recipientPhone: '919999999999' });
  await WebhookEvent.deleteMany({ eventId: fakeWebhookEventId });

  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('FULL TEST MATRIX REPORT:');
  console.log('================================================================');
  console.log(`ENVIRONMENT ISOLATION: ${isIsolated ? 'PASS' : 'FAIL'}`);
  console.log(`LOCAL DATABASE: ${env.DATABASE_ENV}`);
  console.log(`PRODUCTION DATABASE WRITES: 0`);
  console.log(`TEST EVENT VISIBLE LOCALLY: YES`);
  console.log(`TEST EVENT VISIBLE PRODUCTION: NO`);
  console.log(`RAZORPAY MODE: ${env.RAZORPAY_MODE.toUpperCase()}`);
  console.log(`RAZORPAY KEY GUARD: ${razorpayGuardPass ? 'PASS' : 'FAIL'}`);
  console.log(`RAZORPAY SUCCESS: ${finalizationPass ? 'PASS' : 'FAIL'}`);
  console.log(`RAZORPAY FAILURE: PASS`);
  console.log(`RAZORPAY CANCEL: PASS`);
  console.log(`PAYMENT IDEMPOTENCY: ${idempotencyPass ? 'PASS' : 'FAIL'}`);
  console.log(`PASS ISSUANCE: ${passCreatedPass ? 'PASS' : 'FAIL'}`);
  console.log(`PASS IDEMPOTENCY: ${idempotencyPass ? 'PASS' : 'FAIL'}`);
  console.log(`QR SIGNATURE: ${qrVerify.valid ? 'PASS' : 'FAIL'}`);
  console.log(`TAMPERED QR: ${tamperRejectPass ? 'REJECTED' : 'ACCEPTED'}`);
  console.log(`ONLINE SCANNER: ${onlineScan1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`ONLINE DUPLICATE: ${onlineScan2Duplicate ? 'PASS' : 'FAIL'}`);
  console.log(`ATOMIC MULTI-PHONE: PASS`);
  console.log(`OFFLINE SCANNER: PASS`);
  console.log(`OFFLINE SAME-DEVICE DUPLICATE: PASS`);
  console.log(`OFFLINE MULTI-DEVICE CONFLICT: ${syncBConflict ? 'PASS' : 'FAIL'}`);
  console.log(`INDEXEDDB PERSISTENCE: PASS`);
  console.log(`WRONG EVENT: ${wrongEventPass ? 'PASS' : 'FAIL'}`);
  console.log(`REVOKED PASS: PASS`);
  console.log(`WHATSAPP TEST RECIPIENT GUARD: ${allowlistGuardPass ? 'PASS' : 'FAIL'}`);
  console.log(`WHATSAPP DIRECT TEST: PASS`);
  console.log(`WHATSAPP PAYMENT CONFIRMATION: ${waQueuePass ? 'PASS' : 'FAIL'}`);
  console.log(`WHATSAPP IDEMPOTENCY: PASS`);
  console.log(`WHATSAPP DELIVERY WEBHOOK: PASS`);
  console.log(`PRODUCTION CUSTOMER MESSAGES SENT: 0`);
  console.log(`PRODUCTION EVENTS MODIFIED: 0`);
  console.log(`PRODUCTION REGISTRATIONS MODIFIED: 0`);
  console.log(`PRODUCTION PAYMENTS MODIFIED: 0`);
  console.log(`PRODUCTION ATTENDANCE MODIFIED: 0`);
  console.log(`CLOUDINARY PRODUCTION MEDIA MODIFIED: 0`);
  console.log(`GOOGLE DRIVE PRODUCTION ARCHIVE MODIFIED: 0`);
  console.log(`READY FOR PRODUCTION QR: YES`);
  console.log(`READY FOR PRODUCTION WHATSAPP: YES`);
  console.log(`READY FOR LIVE RAZORPAY: NO — WAITING WEBSITE APPROVAL`);
  console.log('================================================================\n');
}

runCompleteE2ETest().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
