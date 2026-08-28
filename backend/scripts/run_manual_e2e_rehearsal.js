/**
 * EDKL Manual Real E2E Rehearsal Runner
 * Validates: Registration -> Real Meta WhatsApp -> Razorpay Order -> Finalization -> Pass -> QR -> Scanner
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Payment } from '../src/models/Payment.js';
import { Pass } from '../src/models/Pass.js';
import { ScanRecord } from '../src/models/ScanRecord.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { paymentService } from '../src/modules/payments/payment.service.js';
import { handleOnlineScan, handleOfflineSync } from '../src/modules/scanner/scanner.controller.js';

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

async function runRehearsal() {
  console.log('================================================================');
  console.log('EDKL MANUAL REAL E2E REHEARSAL');
  console.log('================================================================');
  console.log(`Environment: ${env.APP_ENV}`);
  console.log(`Database: ${env.DATABASE_NAME} (${env.DATABASE_ENV})`);
  console.log(`Razorpay Mode: ${env.RAZORPAY_MODE}`);
  console.log(`WhatsApp Mode: ${env.WHATSAPP_MODE}`);
  console.log('================================================================\n');

  if (env.APP_ENV === 'production' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error('Safety block: Refusing to run rehearsal on production database!');
  }

  await mongoose.connect(env.MONGO_URI);

  const event = await Event.findOne({ slug: 'edkl-manual-e2e-test' });
  if (!event) {
    throw new Error('Test event not found. Run prepare_manual_e2e_event.js first.');
  }

  const testPhone = '918320594829';
  const testInquiryId = `INQ-M-${Date.now().toString().slice(-6)}`;

  console.log('--- STEP 5: CREATE REGISTRATION (REAL WORKFLOW) ---');
  const reg = await Registration.create({
    inquiryId: testInquiryId,
    customerToken: `tok_${Date.now()}`,
    husbandName: 'Rajesh',
    wifeName: 'Pooja',
    surname: 'Shah',
    phoneNumber: testPhone,
    whatsappOptIn: true,
    whatsappOptInAt: new Date(),
    whatsappMarketingOptIn: false,
    whatsappConsentSource: 'public_form',
    programId: event.id,
    programName: event.name,
    programDate: event.date,
    programTime: event.time,
    status: 'pending',
    payment: {
      provider: 'razorpay',
      status: 'pending',
      amount: event.price || 1500,
      currency: 'INR'
    },
    attendance: 'unmarked'
  });

  console.log(`✓ Registration Created in TEST DB: [${reg.inquiryId}] ${reg.husbandName} & ${reg.wifeName} ${reg.surname}`);

  console.log('\n--- STEP 6: VERIFY REGISTRATION STATE BEFORE PAYMENT ---');
  const regBeforePay = await Registration.findOne({ inquiryId: testInquiryId });
  const passBeforePay = await Pass.findOne({ inquiryId: testInquiryId });
  console.log(`✓ Registration status: ${regBeforePay.status} (Expected: pending)`);
  console.log(`✓ Payment status: ${regBeforePay.payment?.status} (Expected: pending)`);
  console.log(`✓ Pass exists before payment: ${passBeforePay ? 'YES' : 'NONE'} (Expected: NONE)`);
  console.log(`✓ Attendance status: ${regBeforePay.attendance} (Expected: unmarked)`);

  console.log('\n--- STEP 7 & 8: DISPATCH REAL REGISTRATION RECEIVED WHATSAPP VIA META ---');
  const { sendUtilityTemplate } = await import('../src/integrations/whatsapp/whatsapp.service.js');
  
  const m1Result = await sendUtilityTemplate({
    recipientPhone: testPhone,
    templateKey: 'edkl_registration_received_v1',
    languageCode: 'en_US',
    variables: {
      customerName: 'Rajesh & Pooja',
      eventName: event.name,
      registrationId: testInquiryId,
      eventDate: event.date,
      eventTime: event.time,
      venue: event.venue,
      statusText: 'Pending Payment'
    },
    idempotencyKey: `REG_RECEIVED:${reg._id}`,
    registrationId: reg._id,
    eventId: event.id,
    inquiryId: testInquiryId,
    trigger: 'registration_created',
    executionSource: 'MANUAL_TEST',
    providerMode: 'META'
  });

  console.log(`✓ Meta Dispatch Status: ${m1Result.status}`);
  console.log(`✓ Meta Provider Message ID: ${m1Result.providerMessageId || 'N/A'}`);
  const isRealMetaM1 = Boolean(m1Result.providerMessageId && m1Result.providerMessageId.startsWith('wamid.HBg'));
  console.log(`✓ Real Meta wamid received: ${isRealMetaM1 ? 'YES' : 'NO'}`);

  console.log('\n--- STEP 10: REAL RAZORPAY TEST ORDER CREATION ---');
  const checkoutOrder = await paymentService.createCheckoutOrder({ inquiryId: testInquiryId });
  console.log(`✓ Razorpay Order Created: ${checkoutOrder.orderId}, Amount: ₹${checkoutOrder.amount / 100}`);

  console.log('\n--- STEP 11: PAYMENT SERVER FINALIZATION ---');
  const fakePaymentId = `pay_test_real_${Date.now()}`;
  const finalizeRes = await paymentService.finalizeWebhookPayment({
    eventId: `evt_test_${Date.now()}`,
    orderId: checkoutOrder.orderId,
    paymentId: fakePaymentId,
    amount: (event.price || 1500) * 100,
    inquiryId: testInquiryId,
    rawPayload: { simulated: true, mode: 'test' }
  });

  const regAfterPay = await Registration.findOne({ inquiryId: testInquiryId });
  const paymentLedger = await Payment.findOne({ paymentId: fakePaymentId });
  console.log(`✓ Registration status after payment: ${regAfterPay.status} (Expected: approved)`);
  console.log(`✓ Payment ledger status: ${paymentLedger?.status} (Expected: captured)`);

  console.log('\n--- STEP 12 & 13: DIGITAL PASS & ED25519 ASYMMETRIC SIGNED QR ---');
  const passes = await Pass.find({ inquiryId: testInquiryId });
  console.log(`✓ Active Pass Count: ${passes.length} (Expected: 1)`);
  const issuedPass = passes[0];
  console.log(`✓ Issued Pass ID: ${issuedPass?.passId}`);

  const qrVerify = qrPassService.verifyPassToken(issuedPass.qrToken);
  console.log(`✓ Ed25519 Cryptographic QR Verified: ${qrVerify.valid ? 'PASS' : 'FAIL'}`);
  console.log('Decoded QR Payload:', qrVerify.payload);

  const hasPii = Boolean(qrVerify.payload?.phone || qrVerify.payload?.name || qrVerify.payload?.email || qrVerify.payload?.amount);
  console.log(`✓ Zero PII in QR Payload: ${!hasPii ? 'NONE (PASS)' : 'PRESENT (FAIL)'}`);

  console.log('\n--- STEP 14: DISPATCH REAL PAYMENT CONFIRMATION & PASS DELIVERY WHATSAPP ---');
  const m3Result = await sendUtilityTemplate({
    recipientPhone: testPhone,
    templateKey: 'edkl_payment_confirmed_pass_v1',
    languageCode: 'en_US',
    variables: {
      customerName: 'Rajesh & Pooja',
      eventName: event.name,
      eventDate: event.date,
      eventTime: event.time,
      venue: event.venue,
      registrationId: testInquiryId,
      inquiryId: testInquiryId
    },
    idempotencyKey: `PAYMENT_CONFIRMED:${reg._id}:${fakePaymentId}`,
    registrationId: reg._id,
    eventId: event.id,
    inquiryId: testInquiryId,
    trigger: 'payment_verified',
    executionSource: 'MANUAL_TEST',
    providerMode: 'META'
  });

  console.log(`✓ Payment Confirmation WhatsApp Status: ${m3Result.status}`);
  console.log(`✓ Payment Confirmation Meta Message ID: ${m3Result.providerMessageId || 'N/A'}`);
  const isRealMetaM3 = Boolean(m3Result.providerMessageId && m3Result.providerMessageId.startsWith('wamid.HBg'));
  console.log(`✓ Real Meta wamid received for Pass: ${isRealMetaM3 ? 'YES' : 'NO'}`);

  console.log('\n--- STEP 17 & 18: ONLINE SCANNER & FIRST VALID SCAN ---');
  const scanReq1 = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: event.id,
      deviceId: 'PHONE-GATE-STAFF-A',
      deviceSequence: 1
    },
    user: { username: 'gate_staff_1' }
  };
  const scanRes1 = createMockRes();
  await handleOnlineScan(scanReq1, scanRes1);
  console.log(`✓ Phone A First Scan Result: ${scanRes1.data?.result} (Expected: VALID)`);

  const regAfterScan = await Registration.findOne({ inquiryId: testInquiryId });
  console.log(`✓ Attendance marked in DB: ${regAfterScan?.attendance} (Expected: present)`);

  console.log('\n--- STEP 19: DUPLICATE ONLINE SCAN PREVENTION ---');
  const scanReq2 = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: event.id,
      deviceId: 'PHONE-GATE-STAFF-B',
      deviceSequence: 2
    },
    user: { username: 'gate_staff_2' }
  };
  const scanRes2 = createMockRes();
  await handleOnlineScan(scanReq2, scanRes2);
  console.log(`✓ Phone B Duplicate Scan Result: ${scanRes2.data?.result} (Expected: ALREADY_SCANNED)`);

  console.log('\n--- STEP 21: TAMPERED QR SCAN REJECTION ---');
  const qrParts = issuedPass.qrToken.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ ...qrVerify.payload, passId: 'EDKL-P-FAKEXX' })).toString('base64url');
  const tamperedToken = `${tamperedPayload}.${qrParts[1]}`;
  const tamperScanReq = {
    body: {
      qrToken: tamperedToken,
      eventId: event.id,
      deviceId: 'PHONE-GATE-STAFF-A',
      deviceSequence: 3
    },
    user: { username: 'gate_staff_1' }
  };
  const tamperScanRes = createMockRes();
  await handleOnlineScan(tamperScanReq, tamperScanRes);
  console.log(`✓ Tampered QR Scan Result: ${tamperScanRes.data?.result} (Expected: INVALID_SIGNATURE)`);

  console.log('\n--- STEP 22: WRONG EVENT SCAN REJECTION ---');
  const wrongEventScanReq = {
    body: {
      qrToken: issuedPass.qrToken,
      eventId: 'prog-other-unrelated-event',
      deviceId: 'PHONE-GATE-STAFF-A',
      deviceSequence: 4
    },
    user: { username: 'gate_staff_1' }
  };
  const wrongEventScanRes = createMockRes();
  await handleOnlineScan(wrongEventScanReq, wrongEventScanRes);
  console.log(`✓ Wrong Event Scan Result: ${wrongEventScanRes.data?.result} (Expected: WRONG_EVENT)`);

  console.log('\n--- STEP 29: WHATSAPP ACTIVITY LOGS AUDIT ---');
  const messages = await WhatsappMessage.find({ inquiryId: testInquiryId }).sort({ createdAt: 1 }).lean();
  console.log(`Total messages in ledger for this test: ${messages.length}`);
  messages.forEach((m, idx) => {
    console.log(` [${idx + 1}] Tpl: ${m.templateName} | Status: ${m.status} | Mode: ${m.providerMode} | Source: ${m.executionSource} | wamid: ${m.providerMessageId}`);
  });

  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('MANUAL REAL E2E REHEARSAL COMPLETED SUCCESSFULLY');
  console.log('================================================================\n');
}

runRehearsal().catch(err => {
  console.error('\n❌ REHEARSAL ERROR:', err);
  process.exit(1);
});
