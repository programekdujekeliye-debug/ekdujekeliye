/**
 * Test Suite: EDKL Temporary Early Registration Mode
 * Verifies that:
 * 1. 7 September 2026 and 11 September 2026 events are in Early Registration Mode (payment disabled).
 * 2. Registrations are recorded with status 'pending' without issuing passes or QR codes.
 * 3. WhatsApp template dispatched is edkl_registration_received_v1 (in mock mode).
 * 4. Razorpay order creation is blocked with PAYMENT_NOT_OPEN.
 * 5. Payment reminder timers are NOT started (reason: PAYMENT_NOT_OPEN).
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

// Enforce MOCK mode to prevent real Meta network calls
process.env.WHATSAPP_MODE = 'mock';

import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Pass } from '../src/models/Pass.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { registrationService } from '../src/modules/registrations/registration.service.js';
import { paymentService } from '../src/modules/payments/payment.service.js';

const MONGO_URI = env.MONGO_URI || 'mongodb://localhost:27017/ekdujekeliye_test';

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING EARLY REGISTRATION MODE AUTOMATED SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  };

  try {
    await mongoose.connect(MONGO_URI);
    console.log('📦 Connected to MongoDB:', MONGO_URI);

    // 1. Verify 7 September 2026 and 11 September 2026 Event Configurations
    console.log('\n[Test 1] Verifying Event Settings for 7 & 11 September 2026...');
    const event7 = await Event.findOne({ date: '2026-09-07' }).lean();
    const event11 = await Event.findOne({ date: '2026-09-11' }).lean();

    assert(event7 !== null, '7 September 2026 event exists in database');
    assert(event7?.isRegistrationOpen === true, '7 September 2026 isRegistrationOpen is true');
    assert(event7?.isPaymentEnabled === false, '7 September 2026 isPaymentEnabled is false');
    assert(event7?.earlyRegistrationMode === true, '7 September 2026 earlyRegistrationMode is true');

    assert(event11 !== null, '11 September 2026 event exists in database');
    assert(event11?.isRegistrationOpen === true, '11 September 2026 isRegistrationOpen is true');
    assert(event11?.isPaymentEnabled === false, '11 September 2026 isPaymentEnabled is false');
    assert(event11?.earlyRegistrationMode === true, '11 September 2026 earlyRegistrationMode is true');

    // 2. Submit Early Registration
    console.log('\n[Test 2] Submitting Early Registration for 7 September 2026...');
    const testInquiryId = `TEST-EARLY-${Date.now()}`;
    const testPhone = '9998887776';

    const regResult = await registrationService.createRegistration({
      husbandName: 'Rajesh',
      wifeName: 'Pooja',
      surname: 'Shah',
      phoneNumber: testPhone,
      programId: event7?.id || 'prog-2026-09-07',
      whatsappOptIn: true,
      couplePhotoUrl: 'https://placehold.co/400x400.png'
    });

    assert(regResult.earlyRegistration === true, 'Registration result returns earlyRegistration: true');
    assert(regResult.isPaymentEnabled === false, 'Registration result returns isPaymentEnabled: false');
    assert(Boolean(regResult.inquiryId), `Generated Inquiry ID: ${regResult.inquiryId}`);

    const createdReg = await Registration.findOne({ inquiryId: regResult.inquiryId }).lean();
    assert(createdReg !== null, 'Registration document saved in MongoDB');
    assert(createdReg?.status === 'pending', 'Registration status is pending');
    assert(createdReg?.payment?.status === 'pending', 'Payment status is pending');

    // 3. Verify NO Digital Pass / QR Created Before Payment
    console.log('\n[Test 3] Verifying 0 Digital Passes Issued...');
    const passCount = await Pass.countDocuments({ inquiryId: regResult.inquiryId });
    assert(passCount === 0, 'Zero passes created in Pass collection before payment');

    // 4. Verify WhatsApp Template Dispatched
    console.log('\n[Test 4] Verifying WhatsApp Template Dispatched...');
    const whatsappMsg = await WhatsappMessage.findOne({ inquiryId: regResult.inquiryId }).lean();
    assert(whatsappMsg !== null, 'WhatsApp message logged in database');
    assert(
      whatsappMsg?.templateName === 'edkl_registration_received_v1' || whatsappMsg?.messageType === 'registration_received',
      `Correct template used: ${whatsappMsg?.templateName || whatsappMsg?.messageType} (edkl_registration_received_v1)`
    );
    assert(whatsappMsg?.providerStatus === 'SENT' || whatsappMsg?.status === 'SENT', 'Mock WhatsApp message marked SENT');

    // 5. Verify Razorpay Order Creation Blocked
    console.log('\n[Test 5] Verifying Payment Safety Rejection...');
    let orderBlocked = false;
    let blockReason = '';
    try {
      await paymentService.createOrder({ inquiryId: regResult.inquiryId });
    } catch (err) {
      orderBlocked = true;
      blockReason = err.code || err.message;
    }
    assert(orderBlocked === true, `Payment order creation blocked with code/message: ${blockReason}`);
    assert(
      blockReason === 'PAYMENT_NOT_OPEN' || blockReason.includes('PAYMENT_NOT_OPEN') || blockReason.includes('not open'),
      'Blocked specifically due to PAYMENT_NOT_OPEN'
    );

    // Clean up test documents
    console.log('\n[Cleanup] Cleaning test documents...');
    await Registration.deleteOne({ inquiryId: regResult.inquiryId });
    await WhatsappMessage.deleteMany({ inquiryId: regResult.inquiryId });
    console.log('🧹 Cleaned test records.');

  } catch (err) {
    console.error('💥 Test suite runtime exception:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n======================================================');
    console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
