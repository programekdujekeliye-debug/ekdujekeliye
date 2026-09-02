import crypto from 'crypto';
import { env, normalizePhoneNumber, maskSecret } from '../config/env.js';
import { Registration, hasOperationalWhatsappConsent } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { qrPassService } from '../modules/passes/qrPass.service.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../models/WhatsappMessage.js';
import { sendUtilityTemplate, maskPhoneNumber, getCachedMetaTemplateStatus } from '../integrations/whatsapp/whatsapp.service.js';
import { ensureFeedbackToken } from '../modules/feedback/feedback.controller.js';
import { invitationCardService } from './invitationCard.service.js';
import { TEMPLATE_REGISTRY } from '../integrations/whatsapp/templateRegistry.js';

let isWorkerRunning = false;

export class CommunicationSchedulerService {
  /**
   * Parse event date and time string into timezone-aware IST Date
   */
  parseEventDateTime(dateStr, timeStr = '8:30 PM') {
    if (!dateStr || dateStr.toUpperCase() === 'TBD') {
      return null;
    }

    try {
      let [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return null;

      let hours = 20;
      let minutes = 30;

      if (timeStr) {
        const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          let h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const mer = (timeMatch[3] || '').toUpperCase();
          if (mer === 'PM' && h < 12) h += 12;
          if (mer === 'AM' && h === 12) h = 0;
          hours = h;
          minutes = m;
        }
      }

      // Construct ISO string with +05:30 offset
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const hh = String(hours).padStart(2, '0');
      const min = String(minutes).padStart(2, '0');
      const isoStr = `${year}-${mm}-${dd}T${hh}:${min}:00+05:30`;

      return new Date(isoStr);
    } catch (_) {
      return null;
    }
  }

  /**
   * Calculate lifecycle target schedule timestamps for an event
   */
  calculateScheduleTimes(eventOrDate, timeStr) {
    const date = (typeof eventOrDate === 'object' && eventOrDate !== null) ? eventOrDate.date : eventOrDate;
    const time = (typeof eventOrDate === 'object' && eventOrDate !== null) ? eventOrDate.time : (timeStr || '8:30 PM');
    const eventStartAt = this.parseEventDateTime(date, time);
    if (!eventStartAt) return null;

    // Default duration 3.5 hours
    const eventEndAt = new Date(eventStartAt.getTime() + 3.5 * 60 * 60 * 1000);

    return {
      eventStartAt,
      eventEndAt,
      passReminder48hSendAt: new Date(eventStartAt.getTime() - 48 * 60 * 60 * 1000),
      invitation24hSendAt: new Date(eventStartAt.getTime() - 24 * 60 * 60 * 1000),
      // Backwards compatible aliases
      invitationSendAt: new Date(eventStartAt.getTime() - 24 * 60 * 60 * 1000),
      reminderSendAt: new Date(eventStartAt.getTime() - 48 * 60 * 60 * 1000),
      feedbackSendAt: new Date(eventEndAt.getTime() + 3 * 60 * 60 * 1000)
    };
  }

  /**
   * Schedule all future lifecycle communications for a confirmed registration
   */
  async scheduleRegistrationLifecycle(registrationOrParams, eventParam, options = {}) {
    let registration = registrationOrParams;
    let event = eventParam;
    let opts = options;

    if (registrationOrParams && registrationOrParams.registration) {
      registration = registrationOrParams.registration;
      event = registrationOrParams.event || eventParam;
      opts = { ...options, ...registrationOrParams };
    }

    if (!event && registration) {
      event = await Event.findOne({ id: registration.eventId || registration.programId });
    }

    if (!registration || !event) return { success: false, reason: 'MISSING_DATA' };

    const schedules = this.calculateScheduleTimes(event);
    if (!schedules) {
      return { success: false, reason: 'EVENT_DATE_TBD' };
    }

    const { eventStartAt, passReminder48hSendAt, invitation24hSendAt } = schedules;
    const inquiryId = registration.inquiryId;
    const phone = registration.phoneNumber;
    const customerName = `${registration.husbandName || ''} & ${registration.wifeName || ''}`.trim() || 'Respected Couple';
    const eventName = event.name || '';
    const eventDate = event.date || '';
    const eventTime = event.time || '8:30 PM';
    const venue = event.venue || '';
    const executionSource = opts.executionSource || 'NORMAL';

    const results = {};
    const now = opts.simulatedNow ? new Date(opts.simulatedNow) : new Date();

    // Purge any obsolete legacy text reminder previously queued for this registration
    await WhatsappMessage.deleteMany({
      inquiryId,
      trigger: 'scheduled_24h_reminder',
      templateName: 'edkl_event_reminder_v1',
      status: 'QUEUED'
    }).catch(() => {});
    const remainingMs = eventStartAt.getTime() - now.getTime();
    const remainingMinutes = remainingMs / (60 * 1000);

    let skipped48hReminder = false;
    let isLateInvitationCatchUp = false;
    let skippedInvitationReason = null;

    // If event has already started, do not schedule any future milestone communications
    if (remainingMinutes <= 0) {
      return {
        success: true,
        schedules,
        skipped: true,
        reason: 'EVENT_STARTED',
        skipped48hReminder: true,
        isLateInvitationCatchUp: false,
        skippedInvitationReason: 'EVENT_STARTED'
      };
    }

    // 1. Milestone: 48h Pass Reminder (Only if > 48h before event and enabled)
    if (event.passReminderEnabled !== false && passReminder48hSendAt > now) {
      const remIdempotencyKey = `REMINDER_48H:${event.id || event.slug}:${registration._id}`;

      results.passReminder = await WhatsappMessage.findOneAndUpdate(
        { idempotencyKey: remIdempotencyKey },
        {
          $setOnInsert: {
            messageId: `WA-SCH-${crypto.randomBytes(8).toString('hex')}`,
            eventId: event.id || event.slug,
            registrationId: registration._id,
            inquiryId,
            recipientPhone: normalizePhoneNumber(phone),
            recipientMasked: maskPhoneNumber(phone),
            templateName: 'edkl_event_pass_reminder_v2',
            templateLanguage: 'en_US',
            templateCategory: 'UTILITY',
            messageType: 'reminder',
            trigger: 'scheduled_48h_pass_reminder',
            executionSource,
            providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
            idempotencyKey: remIdempotencyKey,
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
            scheduledFor: passReminder48hSendAt,
            templateParameters: {
              customerName,
              eventName,
              eventDate,
              eventTime,
              venue,
              registrationId: inquiryId,
              inquiryId
            }
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    } else {
      skipped48hReminder = true;
      console.log(`[CommunicationScheduler] 48h pass reminder skipped for ${inquiryId}: 48H_WINDOW_EXPIRED (remaining: ${Math.round(remainingMinutes)} mins)`);
    }

    // 2. Milestone: 24h Personalized Invitation with IMAGE Header (or Catch-Up)
    const isInvitationDisabled = event.personalizedInvitationEnabled === false;
    if (!isInvitationDisabled) {
      const invitationVersion = registration.invitationVersion || 1;
      const invIdempotencyKey = `INVITATION_24H:${event.id || event.slug}:${registration._id}:v${invitationVersion}`;

      // Check if registration already has an active invitation to enforce max 1 logical invitation
      const existingActiveInv = await WhatsappMessage.findOne({
        inquiryId,
        messageType: 'invitation',
        status: { $in: ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ'] }
      }).select('_id status scheduledFor').lean();

      if (!existingActiveInv) {
        let scheduledFor = null;
        let trigger = 'scheduled_24h_invitation';

        if (invitation24hSendAt > now) {
          // Case A & B: Paid > 24h before event -> Scheduled for normal T-24h
          scheduledFor = invitation24hSendAt;
          trigger = 'scheduled_24h_invitation';
          isLateInvitationCatchUp = false;
        } else if (remainingMinutes >= 120) {
          // Case C & D: Paid between 2h and 24h before event (including Event Day)
          // -> Send as CATCH-UP after a 10-minute cooldown
          const cooldownMins = event.lateInvitationCooldownMinutes !== undefined ? event.lateInvitationCooldownMinutes : 10;
          scheduledFor = new Date(now.getTime() + cooldownMins * 60 * 1000);
          trigger = 'invitation_24h_catchup';
          isLateInvitationCatchUp = true;
          console.log(`[CommunicationScheduler] Scheduling 24h invitation catch-up for ${inquiryId} at ${scheduledFor.toISOString()}`);
        } else {
          // Case E & F: Paid < 2 hours before event -> Skip to avoid spamming customer
          skippedInvitationReason = 'TOO_CLOSE_TO_EVENT';
          console.log(`[CommunicationScheduler] Skipping personalized invitation for ${inquiryId}: TOO_CLOSE_TO_EVENT (${Math.round(remainingMinutes)}m remaining)`);
        }

        if (scheduledFor) {
          // Resolve rendered couple invitation card or fallback photo
          let coupleCardUrl = registration.invitationCardUrl;
          if (!coupleCardUrl) {
            try {
              const cardRes = await invitationCardService.ensureInvitationCardImage(registration, event);
              coupleCardUrl = cardRes?.cardUrl;
            } catch (err) {
              console.warn(`[CommunicationScheduler] Failed to render card image for ${inquiryId}:`, err.message);
            }
          }
          if (!coupleCardUrl) {
            coupleCardUrl = registration.couplePhoto || 'https://www.ekdujekeliye.in/sample_couple.png';
          }

          results.invitation = await WhatsappMessage.findOneAndUpdate(
            { idempotencyKey: invIdempotencyKey },
            {
              $setOnInsert: {
                messageId: `WA-SCH-${crypto.randomBytes(8).toString('hex')}`,
                eventId: event.id || event.slug,
                registrationId: registration._id,
                inquiryId,
                recipientPhone: normalizePhoneNumber(phone),
                recipientMasked: maskPhoneNumber(phone),
                templateName: 'edkl_personal_invitation_24h_v2',
                templateLanguage: 'gu',
                templateCategory: 'UTILITY',
                messageType: 'invitation',
                trigger,
                executionSource,
                providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
                idempotencyKey: invIdempotencyKey,
                status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
                scheduledFor,
                templateParameters: {
                  customerName,
                  eventName,
                  eventDate,
                  eventTime,
                  venue,
                  registrationId: inquiryId,
                  inquiryId,
                  headerImageUrl: coupleCardUrl,
                  imageUrl: coupleCardUrl,
                  invitationImageUrl: coupleCardUrl
                }
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
        }
      }
    } else {
      skippedInvitationReason = 'DISABLED_FOR_EVENT';
      console.log(`[CommunicationScheduler] Skipping 24h invitation for ${inquiryId}: DISABLED_FOR_EVENT`);
    }

    // 3. Post-event feedback is NOT auto-queued here.
    // Instead, at next-day midnight (Asia/Kolkata), status becomes READY TO SEND for admin review and manual trigger.

    return {
      success: true,
      schedules,
      results,
      skipped48hReminder,
      isLateInvitationCatchUp,
      skippedInvitationReason
    };
  }

  /**
   * Process all due scheduled communications with strict eligibility revalidation, concurrency locking, and batch limits
   */
  async processScheduledJobs(options = {}) {
    if (isWorkerRunning && !options.ignoreLock) {
      console.warn('[CommunicationScheduler] Worker run skipped: Previous worker invocation is still active.');
      return { success: false, reason: 'CONCURRENCY_LOCK_ACTIVE' };
    }

    isWorkerRunning = true;
    try {
      // Determine canonical NOW timestamp (supports TEST simulated clock)
      let currentNow = new Date();
      if (options.simulatedNow) {
        if (env.APP_ENV !== 'production' && env.DATABASE_ENV === 'TEST') {
          currentNow = new Date(options.simulatedNow);
          console.log(`[CommunicationScheduler] Using TEST SIMULATED CLOCK: ${currentNow.toISOString()}`);
        } else {
          console.warn('[CommunicationScheduler] SIMULATED CLOCK IGNORED: Only allowed in non-production TEST database.');
        }
      }

      const batchLimit = options.batchSize || 25;

      // 1. Stale Lease Recovery: Reclaim jobs locked > 5 minutes ago if worker crashed
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
      await WhatsappMessage.updateMany(
        {
          status: 'SENDING',
          lockedAt: { $lte: staleThreshold },
          attemptCount: { $lt: 3 }
        },
        {
          $set: { status: WHATSAPP_MESSAGE_STATUSES.QUEUED, lockedAt: null }
        }
      );

      // 2. Fetch candidates for current window
      const candidateQuery = {
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
        scheduledFor: { $lte: currentNow }
      };
      if (options.eventId && options.eventId !== 'all') {
        candidateQuery.eventId = options.eventId;
      }

      const candidateJobs = await WhatsappMessage.find(candidateQuery)
        .sort({ scheduledFor: 1 })
        .limit(batchLimit);

      const summary = {
        totalDue: candidateJobs.length,
        processed: 0,
        sent: 0,
        blockedPendingTemplate: 0,
        skippedIneligible: 0,
        failed: 0
      };

      for (const candidate of candidateJobs) {
        // Atomic Lease Claim: Ensures only one worker process handles this message
        const job = await WhatsappMessage.findOneAndUpdate(
          {
            _id: candidate._id,
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED
          },
          {
            $set: {
              status: 'SENDING',
              lockedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        ).populate('registrationId');

        if (!job) {
          // Claimed by another concurrent process
          continue;
        }

        summary.processed++;

      const registration = job.registrationId;
      if (!registration || registration.isDeleted) {
        job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
        job.lastErrorMessage = 'Registration record deleted or missing.';
        await job.save();
        summary.skippedIneligible++;
        continue;
      }

      // Revalidate: operational WhatsApp consent
      if (!hasOperationalWhatsappConsent(registration)) {
        job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
        job.lastErrorMessage = 'Recipient opted out of WhatsApp messages.';
        await job.save();
        summary.skippedIneligible++;
        continue;
      }

      // Revalidate: Event status
      const event = await Event.findOne({
        $or: [{ id: job.eventId }, { slug: job.eventId }]
      });

      if (!event || event.status === 'archived' || event.status === 'cancelled') {
        job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
        job.lastErrorMessage = `Event ${job.eventId} is inactive or cancelled.`;
        await job.save();
        summary.skippedIneligible++;
        continue;
      }

      // Revalidate: Event Start Cutoff (Do not dispatch reminders, invitations, or payment pending after start)
      const eventStartAt = this.parseEventDateTime(event.date, event.time || '8:30 PM');
      const currentNow = new Date();

      if (eventStartAt && currentNow >= eventStartAt) {
        if (job.messageType === 'payment_pending' || job.messageType === 'reminder' || job.messageType === 'invitation') {
          job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
          job.lastErrorMessage = 'EVENT_STARTED';
          await job.save();
          summary.skippedIneligible++;
          continue;
        }
      }

      // Revalidate: Lead time remaining for invitation catch-up (< 2 hours remaining -> TOO_CLOSE_TO_EVENT)
      if (job.messageType === 'invitation' && eventStartAt) {
        const leadMins = (eventStartAt.getTime() - currentNow.getTime()) / (60 * 1000);
        if (leadMins < 120 && job.trigger === 'invitation_24h_catchup') {
          job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
          job.lastErrorMessage = 'TOO_CLOSE_TO_EVENT';
          await job.save();
          summary.skippedIneligible++;
          continue;
        }
      }

      // Revalidate: Payment Pending messages
      if (job.messageType === 'payment_pending') {
        const isPaid = registration.status === 'approved' || registration.payment?.status === 'captured';
        if (isPaid) {
          job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
          job.lastErrorMessage = 'Registration already paid. Payment reminder cancelled.';
          await job.save();
          summary.skippedIneligible++;
          continue;
        }

        if (event.isPaymentEnabled === false || event.earlyRegistrationMode === true || event.communicationsEnabled === false) {
          job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
          job.lastErrorMessage = 'Event payment/communications are currently disabled.';
          await job.save();
          summary.skippedIneligible++;
          continue;
        }
      } else {
        // Revalidate: Pass status for post-payment lifecycle communications
        const pass = await qrPassService.getPassByInquiryId(registration.inquiryId);
        if (!pass || pass.status !== 'ACTIVE') {
          job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
          job.lastErrorMessage = 'Digital Entry Pass is not ACTIVE.';
          await job.save();
          summary.skippedIneligible++;
          continue;
        }
      }

      // Revalidate: Feedback message requires attendance === 'PRESENT'
      if (job.messageType === 'feedback_request') {
        const isPresent = registration.attendance === 'PRESENT' || registration.attendance === 'present';
        if (!isPresent) {
          job.status = WHATSAPP_MESSAGE_STATUSES.CANCELLED;
          job.lastErrorMessage = `No-show attendee (attendance: ${registration.attendance}). Feedback request cancelled.`;
          await job.save();
          summary.skippedIneligible++;
          continue;
        }
      }

      // Re-verify couple photo for invitation dispatch
      let effectiveVariables = { ...job.templateParameters };
      if (job.messageType === 'invitation') {
        try {
          await invitationCardService.ensureInvitationCard(registration.inquiryId);
          const photo = registration.couplePhoto || 'https://www.ekdujekeliye.in/sample_couple.png';
          effectiveVariables.headerImageUrl = photo;
          effectiveVariables.imageUrl = photo;
          effectiveVariables.invitationImageUrl = photo;
        } catch (_) {
          effectiveVariables.headerImageUrl = 'https://www.ekdujekeliye.in/sample_couple.png';
        }
      }

      // Check Meta Template approval status with graceful fallback
      let effectiveTemplate = job.templateName;
      const templateStatus = await getCachedMetaTemplateStatus(effectiveTemplate, job.templateLanguage || 'en_US');

      if (templateStatus && templateStatus !== 'APPROVED') {
        const tplDef = TEMPLATE_REGISTRY[effectiveTemplate];
        if (tplDef && tplDef.fallbackTemplateKey) {
          const fallbackStatus = await getCachedMetaTemplateStatus(tplDef.fallbackTemplateKey, job.templateLanguage || 'en_US');
          if (fallbackStatus === 'APPROVED' || !fallbackStatus) {
            console.log(`[CommunicationScheduler] '${effectiveTemplate}' status is ${templateStatus}. Using approved fallback '${tplDef.fallbackTemplateKey}'.`);
            effectiveTemplate = tplDef.fallbackTemplateKey;
          } else {
            job.status = WHATSAPP_MESSAGE_STATUSES.BLOCKED_TEMPLATE_PENDING;
            job.lastErrorMessage = `Meta template '${effectiveTemplate}' status is ${templateStatus}.`;
            await job.save();
            summary.blockedPendingTemplate++;
            continue;
          }
        } else {
          job.status = WHATSAPP_MESSAGE_STATUSES.BLOCKED_TEMPLATE_PENDING;
          job.lastErrorMessage = `Meta template '${effectiveTemplate}' status is ${templateStatus}.`;
          await job.save();
          summary.blockedPendingTemplate++;
          continue;
        }
      }

      // Dispatch message
      try {
        const sendResult = await sendUtilityTemplate({
          recipientPhone: job.recipientPhone,
          templateKey: effectiveTemplate,
          languageCode: job.templateLanguage || 'en_US',
          variables: effectiveVariables,
          idempotencyKey: job.idempotencyKey,
          registrationId: registration._id,
          eventId: job.eventId,
          inquiryId: registration.inquiryId,
          trigger: job.trigger,
          executionSource: job.executionSource || 'NORMAL',
          providerMode: job.providerMode || 'META'
        });

        if (sendResult.success) {
          summary.sent++;
        } else {
          summary.failed++;
        }
      } catch (err) {
        summary.failed++;
        job.status = WHATSAPP_MESSAGE_STATUSES.FAILED;
        job.lastErrorMessage = err.message;
        await job.save();
      }
    }

    return summary;
  } finally {
    isWorkerRunning = false;
  }
  }

  /**
   * Recalculate schedules when an event date, time, or venue changes
   */
  async handleEventDetailsUpdated(event, options = {}) {
    if (!event) return { success: false };

    const schedules = this.calculateScheduleTimes(event);
    if (!schedules) return { success: false, reason: 'EVENT_DATE_TBD' };

    const { invitationSendAt, reminderSendAt, feedbackSendAt } = schedules;

    // Update pending unsent scheduled jobs
    await WhatsappMessage.updateMany(
      {
        eventId: event.id || event.slug,
        messageType: 'invitation',
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED
      },
      {
        $set: {
          scheduledFor: invitationSendAt,
          'templateParameters.eventDate': event.date,
          'templateParameters.eventTime': event.time,
          'templateParameters.venue': event.venue
        }
      }
    );

    await WhatsappMessage.updateMany(
      {
        eventId: event.id || event.slug,
        messageType: 'reminder',
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED
      },
      {
        $set: {
          scheduledFor: reminderSendAt,
          'templateParameters.eventName': event.name,
          'templateParameters.eventDate': event.date,
          'templateParameters.eventTime': event.time,
          'templateParameters.venue': event.venue
        }
      }
    );

    await WhatsappMessage.updateMany(
      {
        eventId: event.id || event.slug,
        messageType: 'feedback_request',
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED
      },
      {
        $set: {
          scheduledFor: feedbackSendAt,
          'templateParameters.eventName': event.name
        }
      }
    );

    // Invalidate invitation hashes to trigger automatic card regeneration
    const registrations = await Registration.find({ programId: event.id || event.slug });
    for (const reg of registrations) {
      await invitationCardService.invalidateInvitationIfNeeded(reg.inquiryId, event);
    }

    return { success: true, schedules };
  }

  /**
   * Handle event cancellation: cancels pending jobs and optionally queues cancellation messages
   */
  async handleEventCancelled(event, options = {}) {
    if (!event) return { success: false };

    // 1. Cancel all queued pending lifecycle communications
    const cancelResult = await WhatsappMessage.updateMany(
      {
        eventId: event.id || event.slug,
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED
      },
      {
        $set: {
          status: WHATSAPP_MESSAGE_STATUSES.CANCELLED,
          lastErrorMessage: 'Event was cancelled by authorized administrator.'
        }
      }
    );

    // 2. If notifyAttendees requested, queue edkl_event_cancelled_v1
    if (options.notifyAttendees) {
      const registrations = await Registration.find({
        programId: event.id || event.slug,
        status: 'approved',
        isDeleted: false
      });

      for (const reg of registrations) {
        if (!hasOperationalWhatsappConsent(reg)) continue;

        const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Guest';
        await sendUtilityTemplate({
          recipientPhone: reg.phoneNumber,
          templateKey: 'edkl_event_cancelled_v1',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName: event.name || 'Ek Duje Ke Liye Seminar',
            registrationId: reg.inquiryId,
            eventDate: event.date || ''
          },
          idempotencyKey: `EVENT_CANCELLED:${event.id || event.slug}:${reg._id}`,
          registrationId: reg._id,
          eventId: event.id || event.slug,
          inquiryId: reg.inquiryId,
          trigger: 'event_cancelled'
        });
      }
    }

    return { success: true, cancelledPendingJobs: cancelResult.modifiedCount };
  }
}

export const communicationSchedulerService = new CommunicationSchedulerService();
