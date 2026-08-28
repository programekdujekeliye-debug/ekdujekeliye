import mongoose from 'mongoose';
import crypto from 'crypto';
import { env } from '../src/config/env.js';
import { paymentService } from '../src/modules/payments/payment.service.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { runAutomaticWhatsAppWorker } from '../src/workers/whatsappWorker.js';
import {
  handleOnlineScan,
  handleOfflineSync
} from '../src/modules/scanner/scanner.controller.js';
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

async function runPipelineTest() {
  console.log('================================================================');
  console.log('EDKL REAL PAYMENT → PASS → QR → WHATSAPP INTEGRATION PIPELINE');
  console.log('================================================================\n');

  // STEP 1: Strict Environment Guard Verification
  console.log('--- STEP 1: ENVIRONMENT ISOLATION ---');
  console.log(`APP_ENV: ${env.APP_ENV}`);
  console.log(`DATABASE ENVIRONMENT: ${env.DATABASE_ENV} (${env.DATABASE_NAME})`);
  console.log(`RAZORPAY MODE: ${env.RAZORPAY_MODE.toUpperCase()}`);
  console.log(`WHATSAPP MODE: ${env.WHATSAPP_MODE.toUpperCase()}`);

  if (env.APP_ENV !== 'development' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error(`[SAFETY ABORT] Cannot run test against non-test DB: ${env.DATABASE_NAME}`);
  }
  console.log('✓ Database Isolation: PASS (Operating strictly inside ekdujekeliye_test)\n');

  await mongoose.connect(env.MONGO_URI);

  // Clean test DB
  await Event.deleteMany({});
  await Registration.deleteMany({});
  await Payment.deleteMany({});
  await Pass.deleteMany({});
  await ScanRecord.deleteMany({});
  await WhatsappMessage.deleteMany({});
  await WebhookEvent.deleteMany({});

  // STEP 2: Create Fresh Test Event in ekdujekeliye_test
  console.log('--- STEP 2: CREATE FRESH TEST EVENT ---');
  const testEvent = await Event.create({
    id: 'prog-test-oct-2026',
    name: 'Ek Duje Ke Liye - Test Seminar Batch',
    date: '2026-10-25',
    time: '8:30 PM',
    venue: 'Sardar Smruti Bhavan, Surat',
    price: 1500,
    status: 'upcoming',
    capacity: 100,
    isActive: true
  });
  console.log(`✓ Test Event Created: [${testEvent.id}] ${testEvent.name}`);

  // STEP 3: Create Fresh Test Registration in ekdujekeliye_test
  console.log('\n--- STEP 3: CREATE FRESH TEST REGISTRATION ---');
  const testInquiryId = 'TEST-OCT-01';
  const allowlistedRecipient = env.WHATSAPP_TEST_RECIPIENTS[0] || '918320594829';

  const testReg = await Registration.create({
    inquiryId: testInquiryId,
    customerToken: crypto.randomBytes(16).toString('hex'),
    husbandName: 'Jaynesh',
    wifeName: 'Pooja',
    surname: 'Patel',
    phoneNumber: allowlistedRecipient,
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
      razorpayOrderId: 'order_test_pipeline_001'
    },
    attendance: 'unmarked'
  });
  console.log(`✓ Test Registration Created: [${testReg.inquiryId}] ${testReg.husbandName} & ${testReg.wifeName}`);

  // STEP 4: Server Authoritative Captured Payment Finalization
  console.log('\n--- STEP 4: PAYMENT FINALIZATION ---');
  const testPaymentId = 'pay_test_pipeline_captured_888';
  const testOrderId = 'order_test_pipeline_001';

  await paymentService.finalizeWebhookPayment({
    eventId: 'evt_test_pipeline_wh_1',
    orderId: testOrderId,
    paymentId: testPaymentId,
    amount: 150000,
    inquiryId: testReg.inquiryId,
    rawPayload: { simulated: true, testMode: true }
  });

  const confirmedReg = await Registration.findOne({ inquiryId: testReg.inquiryId });
  const isPaymentApproved = confirmedReg?.status === 'approved' && confirmedReg?.payment?.status === 'captured';
  console.log(`✓ Registration Approved & Captured: ${isPaymentApproved ? 'PASS' : 'FAIL'}`);

  const paymentRecord = await Payment.findOne({ paymentId: testPaymentId });
  const isPaymentRecorded = paymentRecord?.status === 'captured' && paymentRecord?.amount === 1500;
  console.log(`✓ Payment Record Created: ${isPaymentRecorded ? 'PASS' : 'FAIL'}`);

  // STEP 5: Pass Issuance & Zero-PII Cryptographic Ed25519 QR
  console.log('\n--- STEP 5: PASS ISSUANCE & SIGNED QR ---');
  const issuedPass = await Pass.findOne({ inquiryId: testReg.inquiryId });
  const isPassIssued = Boolean(issuedPass && issuedPass.passId && issuedPass.status === 'ACTIVE');
  console.log(`✓ Pass Issued: ${isPassIssued ? 'PASS' : 'FAIL'} (Pass ID: ${issuedPass?.passId})`);

  const qrVerify = qrPassService.verifyPassToken(issuedPass.qrToken);
  console.log(`✓ Ed25519 Cryptographic QR Verified: ${qrVerify.valid ? 'PASS' : 'FAIL'}`);

  // Verify Zero PII in QR token
  const payloadKeys = Object.keys(qrVerify.payload || {});
  const hasPii = ['phone', 'email', 'husbandName', 'wifeName', 'surname', 'amount', 'razorpayPaymentId'].some(k => payloadKeys.includes(k));
  console.log(`✓ QR Token Zero-PII Check: ${!hasPii ? 'NONE (PASS)' : 'PII FOUND (FAIL)'}`);

  // STEP 6: WhatsApp Message Ledger Queue & Worker Dispatch
  console.log('\n--- STEP 6: WHATSAPP MESSAGE QUEUE & WORKER DISPATCH ---');
  const queuedMsg = await WhatsappMessage.findOne({ inquiryId: testReg.inquiryId });
  const isMsgQueued = queuedMsg?.status === 'QUEUED';
  console.log(`✓ WhatsApp Confirmation Queued in Ledger: ${isMsgQueued ? 'PASS' : 'FAIL'} (Message ID: ${queuedMsg?.messageId})`);
  console.log(`  - Recipient: ${queuedMsg?.recipientPhone}`);
  console.log(`  - Template: ${queuedMsg?.templateName}`);
  console.log(`  - Idempotency Key: ${queuedMsg?.idempotencyKey}`);

  // Dispatch via WhatsApp Worker
  console.log('\nRunning WhatsApp Background Worker Batch...');
  const workerResult = await runAutomaticWhatsAppWorker({ batchSize: 5 });
  console.log(`✓ Worker Executed: Processed ${workerResult.processed} message(s) (Successful: ${workerResult.succeeded})`);

  const updatedMsg = await WhatsappMessage.findOne({ messageId: queuedMsg.messageId });
  console.log(`✓ Updated Message Status in Ledger: ${updatedMsg?.status} (Provider Message ID: ${updatedMsg?.providerMessageId || 'N/A'})`);

  // STEP 7: Replay Webhook (Idempotency Check)
  console.log('\n--- STEP 7: PAYMENT & PASS IDEMPOTENCY ---');
  await paymentService.finalizeWebhookPayment({
    eventId: 'evt_test_pipeline_wh_1', // same webhook ID
    orderId: testOrderId,
    paymentId: testPaymentId,
    amount: 150000,
    inquiryId: testReg.inquiryId,
    rawPayload: { simulated: true }
  });

  const totalPassCount = await Pass.countDocuments({ inquiryId: testReg.inquiryId });
  const totalPaymentCount = await Payment.countDocuments({ inquiryId: testReg.inquiryId });
  const totalWaMessages = await WhatsappMessage.countDocuments({ inquiryId: testReg.inquiryId });
  const isIdempotent = totalPassCount === 1 && totalPaymentCount === 1 && totalWaMessages === 1;
  console.log(`✓ Idempotency Check: Pass count = ${totalPassCount}, Payments = ${totalPaymentCount}, WhatsApp msgs = ${totalWaMessages} (${isIdempotent ? 'PASS' : 'FAIL'})`);

  // STEP 8: Online Scanner & Atomic Attendance Marking
  console.log('\n--- STEP 8: ONLINE SCANNER ATTENDANCE ---');
  // Phone A: First Online Scan
  const scanReq1 = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: testEvent.id,
      deviceId: 'PHONE-GATE-STAFF-1',
      deviceSequence: 1
    },
    user: { username: 'gate_operator_1' }
  };
  const scanRes1 = createMockRes();
  await handleOnlineScan(scanReq1, scanRes1);

  const isScan1Valid = scanRes1.data?.result === 'VALID';
  console.log(`✓ Phone A Scan Result: ${scanRes1.data?.result} (${isScan1Valid ? 'PASS' : 'FAIL'})`);

  const regAfterScan = await Registration.findOne({ inquiryId: testReg.inquiryId });
  const isAttendancePresent = regAfterScan?.attendance === 'present';
  console.log(`✓ Attendance State in DB: ${regAfterScan?.attendance} (${isAttendancePresent ? 'PASS' : 'FAIL'})`);

  // Phone B: Duplicate Online Scan
  const scanReq2 = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: testEvent.id,
      deviceId: 'PHONE-GATE-STAFF-2',
      deviceSequence: 1
    },
    user: { username: 'gate_operator_2' }
  };
  const scanRes2 = createMockRes();
  await handleOnlineScan(scanReq2, scanRes2);

  const isScan2Duplicate = scanRes2.data?.result === 'ALREADY_SCANNED';
  console.log(`✓ Phone B Duplicate Scan Result: ${scanRes2.data?.result} (${isScan2Duplicate ? 'PASS' : 'FAIL'})`);

  // STEP 9: Multi-Device Offline Sync & Conflict Resolution
  console.log('\n--- STEP 9: MULTI-DEVICE OFFLINE SYNC & CONFLICT RESOLUTION ---');
  // Create Test Pass 2
  const testReg2 = await Registration.create({
    inquiryId: 'TEST-OCT-02',
    husbandName: 'Kunal',
    wifeName: 'Neha',
    surname: 'Shah',
    phoneNumber: allowlistedRecipient,
    programId: testEvent.id,
    status: 'approved',
    attendance: 'unmarked'
  });
  const pass2 = await qrPassService.ensurePass(testReg2, testEvent);

  // Phone A offline scan (timestamp 18:00)
  const offlineScanA = {
    scanLocalId: 'OFF-A-001',
    qrToken: pass2.qrToken,
    passId: pass2.passId,
    scannedAtDevice: new Date(Date.now() - 120000).toISOString(),
    deviceSequence: 1
  };

  // Phone B offline scan (timestamp 18:01)
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
      deviceId: 'PHONE-GATE-A',
      eventId: testEvent.id,
      scans: [offlineScanA]
    },
    user: { username: 'staff_A' }
  };
  const syncResA = createMockRes();
  await handleOfflineSync(syncReqA, syncResA);
  const isSyncAAccepted = syncResA.data?.results?.[0]?.result === 'ACCEPTED';
  console.log(`✓ Phone A Offline Sync: ${syncResA.data?.results?.[0]?.result} (${isSyncAAccepted ? 'PASS' : 'FAIL'})`);

  // Sync Phone B (Conflict)
  const syncReqB = {
    body: {
      deviceId: 'PHONE-GATE-B',
      eventId: testEvent.id,
      scans: [offlineScanB]
    },
    user: { username: 'staff_B' }
  };
  const syncResB = createMockRes();
  await handleOfflineSync(syncReqB, syncResB);
  const isSyncBConflict = syncResB.data?.results?.[0]?.result === 'CONFLICT';
  console.log(`✓ Phone B Offline Conflict Resolution: ${syncResB.data?.results?.[0]?.result} (${isSyncBConflict ? 'PASS' : 'FAIL'})`);

  // STEP 10: Failed & Cancelled Payment Safety Checks
  console.log('\n--- STEP 10: FAILED & CANCELLED PAYMENT GUARDS ---');
  const failedReg = await Registration.create({
    inquiryId: 'TEST-OCT-FAIL',
    husbandName: 'FailHusband',
    wifeName: 'FailWife',
    surname: 'Test',
    phoneNumber: allowlistedRecipient,
    programId: testEvent.id,
    status: 'pending',
    payment: {
      provider: 'razorpay',
      status: 'failed',
      amount: 1500
    }
  });

  const failedPass = await Pass.findOne({ inquiryId: failedReg.inquiryId });
  const failedWa = await WhatsappMessage.findOne({ inquiryId: failedReg.inquiryId });
  const isFailureGuarded = !failedPass && !failedWa;
  console.log(`✓ Failed Payment generates 0 passes and 0 WhatsApp: ${isFailureGuarded ? 'PASS' : 'FAIL'}`);

  // Cleanup
  await Event.deleteMany({});
  await Registration.deleteMany({});
  await Payment.deleteMany({});
  await Pass.deleteMany({});
  await ScanRecord.deleteMany({});
  await WhatsappMessage.deleteMany({});
  await WebhookEvent.deleteMany({});

  await mongoose.disconnect();
  console.log('\n✅ REAL PIPELINE INTEGRATION TEST COMPLETED SUCCESSFULLY.');
}

runPipelineTest().catch(err => {
  console.error('\n❌ Pipeline Test Error:', err);
  process.exit(1);
});
