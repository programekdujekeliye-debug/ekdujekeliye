import assert from 'assert';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { Pass } from '../src/models/Pass.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { registrationService } from '../src/modules/registrations/registration.service.js';
import { paymentService } from '../src/modules/payments/payment.service.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { communicationSchedulerService } from '../src/services/communicationScheduler.service.js';
import { connectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';

async function runTest() {
  console.log('======================================================');
  console.log('🧪 RUNNING NORMAL PAID MODE VALIDATION SUITE (EK06 & EK07)');
  console.log('======================================================\n');

  await connectDatabase();

  const testEventId = `test-normal-${Date.now()}`;
  let testRegId = null;

  try {
    // 1. Create a Normal Paid Mode Event (like EK06/EK07)
    const testEvent = await Event.create({
      id: testEventId,
      name: 'Ek Duje Ke Liye - Test Normal Mode',
      slug: `test-normal-${Date.now()}`,
      date: '2026-09-11',
      time: '8:30 PM',
      venue: 'Sardar Patel Smruti Bhavan, Varachha, Surat',
      city: 'Surat',
      price: 1500,
      capacity: 500,
      status: 'upcoming',
      isDateFinal: true,
      isRegistrationOpen: true,
      isPaymentEnabled: true,
      earlyRegistrationMode: false,
      personalizedInvitationEnabled: false,
      communicationsEnabled: true
    });

    console.log('✓ Test Event Created (Normal Paid Mode): isPaymentEnabled=true, personalizedInvitationEnabled=false');

    // 2. Submit New Registration
    const regResult = await registrationService.createRegistration({
      husbandName: 'Aarav',
      wifeName: 'Ananya',
      surname: 'Shah',
      phoneNumber: '918320594829',
      programId: testEvent.id,
      whatsappOptIn: true
    });

    testRegId = regResult.inquiryId;
    assert.strictEqual(regResult.earlyRegistration, false, 'earlyRegistration must be false');
    assert.strictEqual(regResult.isPaymentEnabled, true, 'isPaymentEnabled must be true');
    console.log(`✓ New Registration Created: ${regResult.inquiryId} -> Payment immediately available.`);

    // 3. Verify Payment Order Creation is Allowed
    const order = await paymentService.createOrder({ inquiryId: testRegId });
    assert(order.orderId, 'Razorpay order must be created');
    console.log(`✓ Razorpay Order Created: ${order.orderId} for ₹${order.amount / 100}`);

    // 4. Simulate Payment Capture Verification
    const fakePaymentId = `pay_test_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;
    const fakeSignature = crypto.createHmac('sha256', secret).update(`${order.orderId}|${fakePaymentId}`).digest('hex');
    const verifiedReg = await paymentService.verifyPayment({
      razorpayOrderId: order.orderId,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: fakeSignature,
      inquiryId: testRegId
    });

    assert.strictEqual(verifiedReg.status, 'approved', 'Registration status must be approved');
    assert.strictEqual(verifiedReg.payment.status, 'captured', 'Payment status must be captured');
    console.log('✓ Payment Captured & Registration Approved.');

    // 5. Verify Pass and QR Generation
    const pass = await qrPassService.getPassByInquiryId(testRegId);
    assert(pass, 'Pass must exist for confirmed registration');
    assert.strictEqual(pass.status, 'ACTIVE', 'Pass status must be ACTIVE');
    assert(pass.qrToken, 'Pass must contain QR token signature payload');
    console.log(`✓ Digital Pass Created: ${pass.passId} | Status: ${pass.status} | QR Token: ${pass.qrToken.substring(0, 16)}...`);

    // 6. Verify Personalized Invitation is DISABLED
    const invJobs = await WhatsappMessage.find({
      inquiryId: testRegId,
      templateName: 'edkl_personal_invitation_48h_v1'
    });
    assert.strictEqual(invJobs.length, 0, 'Personalized 48h invitation must NOT be scheduled for event with personalizedInvitationEnabled=false');
    console.log('✓ Verified: 0 Personalized Invitation jobs scheduled (DISABLED_FOR_EVENT).');

    // 7. Verify 24h Event Reminder is ENABLED
    const remJobs = await WhatsappMessage.find({
      inquiryId: testRegId,
      templateName: 'edkl_event_reminder_v1'
    });
    assert(remJobs.length > 0, '24h Event reminder must be scheduled');
    console.log(`✓ Verified: 24h Event Reminder scheduled for ${remJobs[0].scheduledFor}.`);

    console.log('\n======================================================');
    console.log('🎉 ALL NORMAL PAID MODE VALIDATION TESTS PASSED (100%)');
    console.log('======================================================');
  } finally {
    // Clean test data
    await Event.deleteMany({ id: testEventId });
    if (testRegId) {
      await Registration.deleteMany({ inquiryId: testRegId });
      await Pass.deleteMany({ inquiryId: testRegId });
      await WhatsappMessage.deleteMany({ inquiryId: testRegId });
    }
    await mongoose.disconnect();
  }
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
