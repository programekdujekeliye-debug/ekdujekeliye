import mongoose from 'mongoose';
import crypto from 'crypto';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { Pass } from '../src/models/Pass.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../src/models/WhatsappMessage.js';
import { eventService } from '../src/modules/events/event.service.js';
import { registrationService } from '../src/modules/registrations/registration.service.js';
import { paymentService } from '../src/modules/payments/payment.service.js';
import { runPaymentReminders } from '../src/jobs/paymentReminders.job.js';
import { communicationSchedulerService } from '../src/services/communicationScheduler.service.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('RUNNING EDKL TEMP REGISTRATION -> PAYMENT ACTIVATION TEST SUITE');
  console.log('====================================================');

  const uri = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri);

  const testEventId = `test-prog-${Date.now()}`;
  const testPhone = '9999900001';

  const testResults = {};

  try {
    // 0. Setup isolated test event in Silent Early Registration Mode
    const testEvent = await Event.create({
      id: testEventId,
      name: 'Test Seminar 2026',
      slug: `test-seminar-${Date.now()}`,
      date: '2026-09-07',
      time: '8:30 PM',
      venue: 'Sardar Smruti Bhavan, Surat',
      city: 'Surat',
      price: 1500,
      capacity: 10,
      status: 'upcoming',
      isDateFinal: true,
      isPaymentEnabled: false,
      earlyRegistrationMode: true,
      communicationsEnabled: false
    });

    // ----------------------------------------------------
    // TEST A: Silent Early Registration
    // ----------------------------------------------------
    const regResult = await registrationService.createRegistration({
      husbandName: 'TestHusband',
      wifeName: 'TestWife',
      surname: 'Patel',
      phoneNumber: testPhone,
      programId: testEvent.id,
      whatsappOptIn: true
    });

    const regDoc = await Registration.findOne({ inquiryId: regResult.inquiryId });
    const waCountA = await WhatsappMessage.countDocuments({ registrationId: regDoc._id });
    const passCountA = await Pass.countDocuments({ registrationId: regDoc._id });

    testResults.testA = {
      name: 'Silent Early Registration',
      registrationSaved: Boolean(regDoc),
      whatsAppMessagesSent: waCountA,
      paymentsCount: 0,
      passesIssued: passCountA,
      seatConfirmed: regDoc.status === 'approved',
      pass: regDoc && waCountA === 0 && passCountA === 0 && regDoc.status === 'pending'
    };

    // ----------------------------------------------------
    // TEST B: Activate payment for existing early Registration
    // ----------------------------------------------------
    const actResult = await eventService.enablePaymentAndCommunications(testEvent.id);
    const waOpenMsgs = await WhatsappMessage.find({ registrationId: regDoc._id, messageType: 'payment_pending', trigger: 'payment_activation_open' });
    const passCountB = await Pass.countDocuments({ registrationId: regDoc._id });

    testResults.testB = {
      name: 'Activate payment for existing early Registration',
      paymentOpenJobsQueued: waOpenMsgs.length,
      passesIssued: passCountB,
      seatConfirmed: (await Registration.findById(regDoc._id)).status === 'approved',
      pass: waOpenMsgs.length === 1 && passCountB === 0
    };

    // ----------------------------------------------------
    // TEST C: Run activation twice (Idempotency)
    // ----------------------------------------------------
    await eventService.enablePaymentAndCommunications(testEvent.id);
    const waOpenMsgsTwice = await WhatsappMessage.find({ registrationId: regDoc._id, messageType: 'payment_pending', trigger: 'payment_activation_open' });

    testResults.testC = {
      name: 'Idempotent Duplicate Activation',
      paymentOpenJobsCount: waOpenMsgsTwice.length,
      pass: waOpenMsgsTwice.length === 1
    };

    // ----------------------------------------------------
    // TEST D: Existing early customer pays
    // ----------------------------------------------------
    const fakePaymentId = `pay_test_${Date.now()}`;
    await paymentService.finalizeWebhookPayment({
      eventId: `evt_test_${Date.now()}`,
      orderId: `order_test_${Date.now()}`,
      paymentId: fakePaymentId,
      amount: 150000,
      inquiryId: regDoc.inquiryId,
      rawPayload: {}
    });

    const updatedRegD = await Registration.findById(regDoc._id);
    const passD = await Pass.findOne({ registrationId: regDoc._id });
    const pendingRemindersD = await WhatsappMessage.countDocuments({
      registrationId: regDoc._id,
      messageType: 'payment_pending',
      status: 'QUEUED'
    });

    testResults.testD = {
      name: 'Existing early customer pays',
      paymentCaptured: updatedRegD.payment?.status === 'captured',
      passCreated: Boolean(passD && passD.status === 'ACTIVE'),
      seatConfirmed: updatedRegD.status === 'approved',
      pendingRemindersCancelled: pendingRemindersD === 0,
      pass: updatedRegD.payment?.status === 'captured' && Boolean(passD) && updatedRegD.status === 'approved' && pendingRemindersD === 0
    };

    // ----------------------------------------------------
    // TEST F, G, H: New Registration after payment enabled
    // ----------------------------------------------------
    const testPhone2 = '9999900002';
    const newRegResult = await registrationService.createRegistration({
      husbandName: 'NewHusband',
      wifeName: 'NewWife',
      surname: 'Shah',
      phoneNumber: testPhone2,
      programId: testEvent.id,
      whatsappOptIn: true
    });

    const newRegDoc = await Registration.findOne({ inquiryId: newRegResult.inquiryId });
    testResults.testF_creation = {
      name: 'New registration with payment enabled',
      checkoutImmediatelyAvailable: newRegResult.isPaymentEnabled === true,
      pass: newRegResult.isPaymentEnabled === true && newRegResult.earlyRegistration === false
    };

    // Simulate payment opened 20 minutes ago, and registration created 15 minutes ago (unpaid checkout abandonment)
    await mongoose.connection.db.collection('program').updateOne(
      { id: testEvent.id },
      { $set: { paymentOpenedAt: new Date(Date.now() - 20 * 60 * 1000) } }
    );
    await mongoose.connection.db.collection('submission').updateOne(
      { _id: newRegDoc._id },
      { $set: { createdAt: new Date(Date.now() - 15 * 60 * 1000) } }
    );

    const checkDoc = await Registration.findById(newRegDoc._id).lean();
    console.log('DEBUG checkDoc after raw update:', { id: checkDoc._id, programId: checkDoc.programId, status: checkDoc.status, createdAt: checkDoc.createdAt });

    await runPaymentReminders();
    const rem10m = await WhatsappMessage.findOne({
      registrationId: newRegDoc._id,
      trigger: 'payment_reminder_10m'
    });

    testResults.testH_abandonment = {
      name: 'Abandoned checkout 10-minute reminder',
      reminderQueued: Boolean(rem10m),
      pass: Boolean(rem10m)
    };

    // ----------------------------------------------------
    // TEST J & K: Past or Cancelled Event
    // ----------------------------------------------------
    const cancelledEvent = await Event.create({
      id: `test-cancelled-${Date.now()}`,
      name: 'Cancelled Seminar',
      slug: `cancelled-${Date.now()}`,
      date: '2026-09-07',
      capacity: 100,
      status: 'cancelled',
      isPaymentEnabled: false
    });

    let cancelledErrorCaught = false;
    try {
      await eventService.enablePaymentAndCommunications(cancelledEvent.id);
    } catch (e) {
      cancelledErrorCaught = true;
    }

    testResults.testK_cancelled = {
      name: 'Cancelled event payment activation blocked',
      blocked: cancelledErrorCaught,
      pass: cancelledErrorCaught
    };

    // ----------------------------------------------------
    // Cleanup Test Data
    // ----------------------------------------------------
    await Registration.deleteMany({ programId: { $in: [testEventId, cancelledEvent.id] } });
    await WhatsappMessage.deleteMany({ eventId: { $in: [testEventId, cancelledEvent.id] } });
    await Pass.deleteMany({ eventId: { $in: [testEventId, cancelledEvent.id] } });
    await Event.deleteMany({ id: { $in: [testEventId, cancelledEvent.id] } });

    console.log('\n=== TEST RESULTS SUMMARY ===');
    console.log(JSON.stringify(testResults, null, 2));

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    process.exit(0);
  }
}

runTestSuite().catch(console.error);
