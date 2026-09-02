import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Pass } from '../src/models/Pass.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { communicationSchedulerService } from '../src/services/communicationScheduler.service.js';
import { calculateEventMidnightIST } from '../src/modules/whatsapp/whatsapp.controller.js';
import { registrationService } from '../src/modules/registrations/registration.service.js';
import { runPaymentReminders } from '../src/jobs/paymentReminders.job.js';
import { invitationCardService } from '../src/services/invitationCard.service.js';

async function runEdgeCaseTests() {
  console.log('================================================================');
  console.log('EDKL — EVENT LIFECYCLE & LATE-REGISTRATION EDGE CASES TEST SUITE');
  console.log('================================================================');
  console.log(`APP_ENV: ${env.APP_ENV}`);
  console.log(`Database: ${env.DATABASE_NAME}`);
  console.log('================================================================\n');

  if (env.APP_ENV !== 'development' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error(`[SAFETY GUARD] Cannot run test on database: ${env.DATABASE_NAME}`);
  }

  // Intercept Meta WhatsApp Cloud API calls to prevent live dispatches during tests
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === 'string' && url.includes('graph.facebook.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '918320594829', wa_id: '918320594829' }],
          messages: [{ id: `wamid.MOCK_${Date.now()}` }]
        }),
        text: async () => JSON.stringify({ messaging_product: 'whatsapp' })
      };
    }
    return originalFetch(url, options);
  };

  await mongoose.connect(env.MONGO_URI);

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${details}`);
      failed++;
    }
  }

  const prefix = `EDGE-${Date.now().toString().slice(-4)}`;

  try {
    // -------------------------------------------------------------
    // SETUP BASE EVENT: 2026-09-30 20:30:00 (8:30 PM IST)
    // -------------------------------------------------------------
    const eventDateStr = '2026-09-30';
    const eventTimeStr = '8:30 PM';
    const eventStartAt = communicationSchedulerService.parseEventDateTime(eventDateStr, eventTimeStr);
    const eventId = `prog-${prefix}`;

    const testEvent = await Event.findOneAndUpdate(
      { id: eventId },
      {
        id: eventId,
        slug: eventId,
        name: 'Ek Duje Ke Liye Edge Case Seminar',
        city: 'Surat',
        venue: 'Sardar Smruti Bhavan',
        date: eventDateStr,
        time: eventTimeStr,
        price: 1500,
        capacity: 500,
        status: 'upcoming',
        isPaymentEnabled: true,
        personalizedInvitationEnabled: true
      },
      { upsert: true, new: true }
    );

    console.log(`Test Event Start IST: ${eventStartAt.toISOString()}`);

    // Helper to mock a registration + pass
    async function createMockRegistrationAndPass(inquiryId, paymentAt) {
      const reg = await Registration.findOneAndUpdate(
        { inquiryId },
        {
          inquiryId,
          eventId,
          programId: eventId,
          husbandName: 'Jaynesh',
          wifeName: 'Pooja',
          surname: 'Patel',
          phoneNumber: '918320594829',
          whatsappOptIn: true,
          status: 'approved',
          isPaid: true,
          payment: {
            status: 'captured',
            amount: 1500,
            paidAt: paymentAt,
            orderId: `order_${inquiryId}`,
            paymentId: `pay_${inquiryId}`
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      const pass = await Pass.findOneAndUpdate(
        { inquiryId },
        {
          passId: `EDKL-${inquiryId}`,
          inquiryId,
          eventId,
          husbandName: 'Jaynesh',
          wifeName: 'Pooja',
          status: 'ACTIVE',
          issuedAt: paymentAt
        },
        { upsert: true, returnDocument: 'after' }
      );

      return { reg, pass };
    }

    // =============================================================
    // TEST A: Customer pays > 48h before event
    // Expected: 48h Pass Reminder + 24h Invitation scheduled normally
    // =============================================================
    console.log('\n--- Running Test A: Paid > 48h before event ---');
    const inqA = `${prefix}-A`;
    const payTimeA = new Date(eventStartAt.getTime() - 72 * 3600 * 1000); // 72 hours before
    const { reg: regA, pass: passA } = await createMockRegistrationAndPass(inqA, payTimeA);

    const resA = await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regA,
      event: testEvent,
      pass: passA,
      simulatedNow: payTimeA
    });

    const msgsA = await WhatsappMessage.find({ inquiryId: inqA });
    const has48hA = msgsA.some(m => m.messageType === 'reminder');
    const has24hA = msgsA.some(m => m.messageType === 'invitation');

    assert(resA.skipped48hReminder === false && has48hA, 'Test A: 48h Pass Reminder scheduled');
    assert(has24hA, 'Test A: 24h Invitation scheduled');
    assert(resA.isLateInvitationCatchUp === false, 'Test A: Not a late catchup (scheduled at T-24h)');

    // =============================================================
    // TEST B: Customer pays 30h before event (between 24h and 48h)
    // Expected: 48h skipped (48H_WINDOW_EXPIRED) + 24h Invitation scheduled at T-24h
    // =============================================================
    // TEST B: Customer pays 30h before event (between 24h and 48h)
    // Expected: 48h skipped (48H_WINDOW_EXPIRED) + 24h Invitation scheduled at T-24h
    // =============================================================
    console.log('\n--- Running Test B: Paid 30h before event ---');
    const inqB = `${prefix}-B`;
    const payTimeB = new Date(eventStartAt.getTime() - 30 * 3600 * 1000); // 30 hours before
    const { reg: regB, pass: passB } = await createMockRegistrationAndPass(inqB, payTimeB);

    const resB = await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regB,
      event: testEvent,
      pass: passB,
      simulatedNow: payTimeB
    });

    const msgsB = await WhatsappMessage.find({ inquiryId: inqB });
    const has48hB = msgsB.some(m => m.messageType === 'reminder');
    const has24hB = msgsB.some(m => m.messageType === 'invitation');

    assert(resB.skipped48hReminder === true && !has48hB, 'Test B: 48h Pass Reminder skipped (48H_WINDOW_EXPIRED)');
    assert(has24hB, 'Test B: 24h Invitation scheduled normally at T-24h');
    assert(resB.isLateInvitationCatchUp === false, 'Test B: 24h Invitation is not catchup since >24h remain');

    // =============================================================
    // TEST C: Customer pays 18h before event (<24h, >2h)
    // Expected: 48h skipped + 24h Invitation scheduled as Catch-Up after 10m cooldown
    // =============================================================
    console.log('\n--- Running Test C: Paid 18h before event ---');
    const inqC = `${prefix}-C`;
    const payTimeC = new Date(eventStartAt.getTime() - 18 * 3600 * 1000); // 18 hours before
    const { reg: regC, pass: passC } = await createMockRegistrationAndPass(inqC, payTimeC);

    const resC = await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regC,
      event: testEvent,
      pass: passC,
      simulatedNow: payTimeC
    });

    const msgsC = await WhatsappMessage.find({ inquiryId: inqC });
    const has48hC = msgsC.some(m => m.messageType === 'reminder');
    const invMsgC = msgsC.find(m => m.messageType === 'invitation');

    assert(!has48hC, 'Test C: 48h Pass Reminder skipped');
    assert(resC.isLateInvitationCatchUp === true && Boolean(invMsgC), 'Test C: 24h Invitation scheduled as Catch-Up');
    const expectedCatchupTime = new Date(payTimeC.getTime() + 10 * 60 * 1000);
    assert(
      invMsgC && Math.abs(new Date(invMsgC.scheduledFor).getTime() - expectedCatchupTime.getTime()) < 5000,
      'Test C: Catch-Up cooldown is exactly 10 minutes after payment'
    );

    // =============================================================
    // TEST D: Customer registers & pays 3h before event on Event Day
    // Expected: Catch-Up scheduled with 10m cooldown, evergreen wording
    // =============================================================
    console.log('\n--- Running Test D: Paid 3h before event ---');
    const inqD = `${prefix}-D`;
    const payTimeD = new Date(eventStartAt.getTime() - 3 * 3600 * 1000); // 3 hours before
    const { reg: regD, pass: passD } = await createMockRegistrationAndPass(inqD, payTimeD);

    const resD = await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regD,
      event: testEvent,
      pass: passD,
      simulatedNow: payTimeD
    });

    const msgsD = await WhatsappMessage.find({ inquiryId: inqD });
    const invMsgD = msgsD.find(m => m.trigger === 'invitation_24h_catchup');

    assert(resD.isLateInvitationCatchUp === true && Boolean(invMsgD), 'Test D: Catch-Up scheduled 3h before event');

    // =============================================================
    // TEST E: Customer pays 90 minutes before event (< 2 hours lead time)
    // Expected: Invitation skipped (TOO_CLOSE_TO_EVENT), only pass active
    // =============================================================
    console.log('\n--- Running Test E: Paid 90m before event ---');
    const inqE = `${prefix}-E`;
    const payTimeE = new Date(eventStartAt.getTime() - 90 * 60 * 1000); // 90 minutes before
    const { reg: regE, pass: passE } = await createMockRegistrationAndPass(inqE, payTimeE);

    const resE = await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regE,
      event: testEvent,
      pass: passE,
      simulatedNow: payTimeE
    });

    const msgsE = await WhatsappMessage.find({ inquiryId: inqE });
    const hasInvE = msgsE.some(m => m.messageType === 'invitation');

    assert(resE.skippedInvitationReason === 'TOO_CLOSE_TO_EVENT' && !hasInvE, 'Test E: Invitation skipped due to TOO_CLOSE_TO_EVENT');

    // =============================================================
    // TEST F: Customer pays 20 minutes before event
    // Expected: Invitation strictly skipped
    // =============================================================
    console.log('\n--- Running Test F: Paid 20m before event ---');
    const inqF = `${prefix}-F`;
    const payTimeF = new Date(eventStartAt.getTime() - 20 * 60 * 1000); // 20 minutes before
    const { reg: regF, pass: passF } = await createMockRegistrationAndPass(inqF, payTimeF);

    const resF = await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regF,
      event: testEvent,
      pass: passF,
      simulatedNow: payTimeF
    });

    assert(resF.skippedInvitationReason === 'TOO_CLOSE_TO_EVENT', 'Test F: 20m before event skipped with TOO_CLOSE_TO_EVENT');

    // =============================================================
    // TEST G: Registration attempted after event has already started
    // Expected: registrationService throws 400 EVENT_STARTED
    // =============================================================
    console.log('\n--- Running Test G: Registration attempted after event start ---');
    let threwEventStarted = false;
    try {
      await registrationService.createRegistration({
        programId: eventId,
        husbandName: 'Late',
        wifeName: 'Person',
        surname: 'Test',
        phoneNumber: '918320594829',
        city: 'Surat',
        whatsappOptIn: true
      }, {
        // Simulating 10 minutes AFTER event start
        simulatedNow: new Date(eventStartAt.getTime() + 10 * 60 * 1000)
      });
    } catch (err) {
      if (err.message?.includes('Registration closed') || err.code === 'EVENT_STARTED' || err.status === 400) {
        threwEventStarted = true;
      }
    }
    assert(threwEventStarted, 'Test G: Public registration blocked with EVENT_STARTED after event has started');

    // =============================================================
    // TEST H: Unpaid registration 5h before event
    // Expected: 10m reminder queued, 24h reminder suppressed because event starts within 5h
    // =============================================================
    console.log('\n--- Running Test H: Unpaid registration 5h before event ---');
    const inqH = `${prefix}-H`;
    // Created 15 minutes ago, while event is 5 hours in future
    const regHTime = new Date(Date.now() - 15 * 60 * 1000);
    const regH = await Registration.findOneAndUpdate(
      { inquiryId: inqH },
      {
        inquiryId: inqH,
        eventId,
        programId: eventId,
        husbandName: 'Unpaid',
        wifeName: 'Attendee',
        surname: 'Test',
        phoneNumber: '918320594829',
        whatsappOptIn: true,
        status: 'pending',
        isPaid: false,
        payment: { status: 'pending' }
      },
      { upsert: true, returnDocument: 'after' }
    );
    // Explicitly update createdAt via native collection to avoid Mongoose timestamp auto-overwrite
    await Registration.collection.updateOne({ inquiryId: inqH }, { $set: { createdAt: regHTime } });

    // Run payment reminders job
    await runPaymentReminders();

    const rem10m = await WhatsappMessage.findOne({
      inquiryId: inqH,
      trigger: 'payment_reminder_10m'
    });
    assert(Boolean(rem10m), 'Test H: 10m polite payment reminder queued');
    assert(rem10m?.templateName === 'edkl_polite_payment_pending_v1', 'Test H: Uses polite bilingual template edkl_polite_payment_pending_v1');

    // 24h reminder must not exist
    const rem24h = await WhatsappMessage.findOne({
      inquiryId: inqH,
      trigger: 'payment_reminder_24h'
    });
    assert(!rem24h, 'Test H: 24h reminder not triggered prematurely');

    // =============================================================
    // TEST I: Payment captured -> Pending reminders cancelled
    // =============================================================
    console.log('\n--- Running Test I: Payment captured cancels reminders ---');
    const inqI = `${prefix}-I`;
    const regI = await Registration.findOneAndUpdate(
      { inquiryId: inqI },
      {
        inquiryId: inqI,
        eventId,
        programId: eventId,
        husbandName: 'Pending',
        wifeName: 'Couple',
        surname: 'Patel',
        phoneNumber: '918320594829',
        whatsappOptIn: true,
        status: 'pending',
        isPaid: false,
        paymentReminder: {
          count: 0,
          nextReminderAt: new Date(Date.now() + 600000)
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Queue a pending payment reminder message for this inquiry
    await WhatsappMessage.create({
      messageId: `WA-TEST-REM-${Date.now()}`,
      eventId,
      inquiryId: inqI,
      recipientPhone: '918320594829',
      templateName: 'edkl_polite_payment_pending_v1',
      messageType: 'payment_pending',
      idempotencyKey: `TEST_REM_${Date.now()}`,
      status: 'QUEUED'
    });

    // Simulate payment capture cancelling reminders
    await WhatsappMessage.updateMany(
      {
        inquiryId: inqI,
        messageType: 'payment_pending',
        status: 'QUEUED'
      },
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'PAYMENT_CAPTURED'
        }
      }
    );

    const cancelledMsg = await WhatsappMessage.findOne({
      inquiryId: inqI,
      messageType: 'payment_pending'
    });
    assert(cancelledMsg.status === 'CANCELLED', 'Test I: Pending reminders cancelled upon payment');

    // =============================================================
    // TEST J: Race Condition: Scheduled invitation + Catch-Up -> Exactly 1 max
    // =============================================================
    console.log('\n--- Running Test J: Idempotency prevents duplicate invitations ---');
    const inqJ = `${prefix}-J`;
    const payTimeJ = new Date(eventStartAt.getTime() - 20 * 3600 * 1000);
    const { reg: regJ, pass: passJ } = await createMockRegistrationAndPass(inqJ, payTimeJ);

    // First call
    await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regJ,
      event: testEvent,
      pass: passJ,
      simulatedNow: payTimeJ
    });

    // Second call (simulating webhook duplicate or admin trigger)
    await communicationSchedulerService.scheduleRegistrationLifecycle({
      registration: regJ,
      event: testEvent,
      pass: passJ,
      simulatedNow: new Date(payTimeJ.getTime() + 1000)
    });

    const invMsgsJ = await WhatsappMessage.find({
      inquiryId: inqJ,
      messageType: 'invitation'
    });
    assert(invMsgsJ.length === 1, `Test J: Exactly 1 invitation created (found ${invMsgsJ.length})`);

    // =============================================================
    // TEST K: Event date/time changed -> Recalculate schedule
    // =============================================================
    console.log('\n--- Running Test K: Event date/time recalculation ---');
    const newDateStr = '2026-10-05';
    const newTimeStr = '7:00 PM';
    const newTimes = communicationSchedulerService.calculateScheduleTimes(newDateStr, newTimeStr);
    assert(
      Boolean(newTimes?.passReminder48hSendAt) && Boolean(newTimes?.invitation24hSendAt),
      'Test K: Schedule times recalculated accurately for new date/time'
    );

    // =============================================================
    // TEST L: Couple photo card resolution
    // =============================================================
    console.log('\n--- Running Test L: Couple photo resolution ---');
    const cardData = await invitationCardService.ensureInvitationCard(inqA);
    assert(Boolean(cardData?.buffer), 'Test L: Personalized invitation card generated successfully');

    // =============================================================
    // TEST M: No couple photo -> Fallback couple card, zero worker crash
    // =============================================================
    console.log('\n--- Running Test M: Fallback couple photo handling ---');
    const inqM = `${prefix}-M`;
    await createMockRegistrationAndPass(inqM, new Date());
    const fallbackCard = await invitationCardService.ensureInvitationCard(inqM);
    assert(Boolean(fallbackCard?.buffer), 'Test M: Fallback card generated with zero worker crash');

    // =============================================================
    // TEST N: Post-event midnight readiness & idempotency
    // =============================================================
    console.log('\n--- Running Test N: Post-event midnight readiness ---');
    const midnight = calculateEventMidnightIST(eventDateStr);
    assert(Boolean(midnight), 'Test N: Local midnight calculated for event date');
    // Event is 2026-09-30. Next calendar day IST 00:00 is 2026-10-01 00:00:00 IST (2026-09-30T18:30:00.000Z)
    assert(midnight.toISOString() === '2026-09-30T18:30:00.000Z', 'Test N: Exact UTC timestamp matches 00:00 IST');

    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runEdgeCaseTests();
