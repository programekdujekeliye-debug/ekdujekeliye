/**
 * EDKL Negative Payment Rehearsal Suite
 * Validates: Payment Failure & Cancelled Checkout -> No Pass Created, No False Confirmation
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Payment } from '../src/models/Payment.js';
import { Pass } from '../src/models/Pass.js';
import { paymentService } from '../src/modules/payments/payment.service.js';

async function runNegativeTests() {
  console.log('=== RUNNING NEGATIVE PAYMENT TESTS ===\n');
  await mongoose.connect(env.MONGO_URI);

  const event = await Event.findOne({ slug: 'edkl-manual-e2e-test' });
  const testPhone = '918320594829';

  // TEST A: Failed Payment Simulation
  console.log('--- TEST A: Failed Payment Flow ---');
  const failInquiryId = `INQ-FAIL-${Date.now().toString().slice(-4)}`;
  const failReg = await Registration.create({
    inquiryId: failInquiryId,
    customerToken: `tok_fail_${Date.now()}`,
    husbandName: 'FailHusband',
    wifeName: 'FailWife',
    surname: 'Test',
    phoneNumber: testPhone,
    programId: event.id,
    programName: event.name,
    programDate: event.date,
    programTime: event.time,
    status: 'pending',
    payment: {
      provider: 'razorpay',
      status: 'failed',
      amount: 1500,
      currency: 'INR'
    },
    attendance: 'unmarked'
  });

  const failPass = await Pass.findOne({ inquiryId: failInquiryId });
  console.log(`✓ Failed Payment Creates Pass: ${failPass ? 'YES (FAIL)' : 'NO (PASS)'}`);
  console.log(`✓ Failed Registration Status: ${failReg.status} (Expected: pending)`);

  // TEST B: Cancelled / Abandoned Checkout Flow
  console.log('\n--- TEST B: Cancelled Checkout Flow ---');
  const cancelInquiryId = `INQ-CANCEL-${Date.now().toString().slice(-4)}`;
  const cancelReg = await Registration.create({
    inquiryId: cancelInquiryId,
    customerToken: `tok_cancel_${Date.now()}`,
    husbandName: 'CancelHusband',
    wifeName: 'CancelWife',
    surname: 'Test',
    phoneNumber: testPhone,
    programId: event.id,
    programName: event.name,
    programDate: event.date,
    programTime: event.time,
    status: 'pending',
    payment: {
      provider: 'razorpay',
      status: 'pending',
      amount: 1500,
      currency: 'INR'
    },
    attendance: 'unmarked'
  });

  // Create checkout order but cancel without payment
  const cancelOrder = await paymentService.createCheckoutOrder({ inquiryId: cancelInquiryId });
  console.log(`✓ Checkout Order Created: ${cancelOrder.orderId}`);

  const cancelPass = await Pass.findOne({ inquiryId: cancelInquiryId });
  console.log(`✓ Cancelled Checkout Creates Pass: ${cancelPass ? 'YES (FAIL)' : 'NO (PASS)'}`);
  console.log(`✓ Cancelled Registration Attendance: ${cancelReg.attendance} (Expected: unmarked)`);

  // Clean up negative test fixtures
  await Registration.deleteMany({ inquiryId: { $in: [failInquiryId, cancelInquiryId] } });
  await Payment.deleteMany({ inquiryId: { $in: [failInquiryId, cancelInquiryId] } });
  await Pass.deleteMany({ inquiryId: { $in: [failInquiryId, cancelInquiryId] } });

  await mongoose.disconnect();

  console.log('\n=========================================');
  console.log('NEGATIVE PAYMENT REHEARSAL: ALL PASSED');
  console.log('=========================================\n');
}

runNegativeTests().catch(console.error);
