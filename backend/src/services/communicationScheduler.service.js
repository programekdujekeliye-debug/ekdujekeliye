import crypto from 'crypto';
import { env, normalizePhoneNumber, maskSecret } from '../config/env.js';
import { Registration, hasOperationalWhatsappConsent } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { qrPassService } from '../modules/passes/qrPass.service.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../models/WhatsappMessage.js';
import { sendUtilityTemplate, maskPhoneNumber } from '../integrations/whatsapp/whatsapp.service.js';
import { getCachedMetaTemplateStatus } from '../integrations/whatsapp/whatsapp.service.js';
import { ensureFeedbackToken } from '../modules/feedback/feedback.controller.js';
import { invitationCardService } from './invitationCard.service.js';

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
  calculateScheduleTimes(event) {
    const eventStartAt = this.parseEventDateTime(event.date, event.time);
    if (!eventStartAt) return null;

    // Default duration 3.5 hours
    const eventEndAt = new Date(eventStartAt.getTime() + 3.5 * 60 * 60 * 1000);

    return {
      eventStartAt,
      eventEndAt,
      invitationSendAt: new Date(eventStartAt.getTime() - 48 * 60 * 60 * 1000),
      reminderSendAt: new Date(eventStartAt.getTime() - 24 * 60 * 60 * 1000),
      feedbackSendAt: new Date(eventEndAt.getTime() + 3 * 60 * 60 * 1000)
    };
  }

  /**
   * Schedule all future lifecycle communications for a confirmed registration
   */
  async scheduleRegistrationLifecycle(registration, event, options = {}) {
    if (!registration || !event) return { success: false, reason: 'MISSING_DATA' };

    const schedules = this.calculateScheduleTimes(event);
    if (!schedules) {
      return { success: false, reason: 'EVENT_DATE_TBD' };
    }

    const { invitationSendAt, reminderSendAt, feedbackSendAt } = schedules;
    const inquiryId = registration.inquiryId;
    const phone = registration.phoneNumber;
    const customerName = `${registration.husbandName || ''} & ${registration.wifeName || ''}`.trim() || 'Respected Couple';
    const eventName = event.name || 'Ek Duje Ke Liye Seminar';
    const eventDate = event.date || '';
    const eventTime = event.time || '8:30 PM';
    const venue = event.venue || 'Sardar Smruti Bhavan, Surat';
    const executionSource = options.executionSource || 'NORMAL';

    const results = {};
    const now = new Date();
    const isInvitationDisabled = event.personalizedInvitationEnabled === false || ['prog-2026-09-07', 'prog-2026-09-11', 'surat-7-september-2026', 'surat-11-september-2026'].includes(event.id) || ['prog-2026-09-07', 'prog-2026-09-11', 'surat-7-september-2026', 'surat-11-september-2026'].includes(event.slug);

    // 1. Schedule 48h Personalized Invitation (Only if enabled for event and in future)
    if (!isInvitationDisabled && invitationSendAt > now) {
      const invitationVersion = registration.invitationVersion || 1;
      const invIdempotencyKey = `INVITATION_48H:${event.id || event.slug}:${registration._id}:v${invitationVersion}`;

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
            templateName: 'edkl_personal_invitation_48h_v1',
            templateLanguage: 'en_US',
            templateCategory: 'UTILITY',
            messageType: 'invitation',
            trigger: 'scheduled_48h_invitation',
            executionSource,
            providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
            idempotencyKey: invIdempotencyKey,
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
            scheduledFor: invitationSendAt,
            templateParameters: {
              customerName,
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
    } else if (isInvitationDisabled) {
      console.log(`[CommunicationScheduler] Skipping 48h invitation for ${inquiryId}: disabled for event (${event.id || event.slug})`);
    } else {
      console.log(`[CommunicationScheduler] Skipping expired 48h invitation for ${inquiryId} (scheduled time was ${invitationSendAt.toISOString()})`);
    }

    // 2. Schedule 24h Event Reminder (Only if reminderSendAt is in the future)
    if (reminderSendAt > now) {
      const remIdempotencyKey = `REMINDER_24H:${event.id || event.slug}:${registration._id}`;

      results.reminder = await WhatsappMessage.findOneAndUpdate(
        { idempotencyKey: remIdempotencyKey },
        {
          $setOnInsert: {
            messageId: `WA-SCH-${crypto.randomBytes(8).toString('hex')}`,
            eventId: event.id || event.slug,
            registrationId: registration._id,
            inquiryId,
            recipientPhone: normalizePhoneNumber(phone),
            recipientMasked: maskPhoneNumber(phone),
            templateName: 'edkl_event_reminder_v1',
            templateLanguage: 'en_US',
            templateCategory: 'UTILITY',
            messageType: 'reminder',
            trigger: 'scheduled_24h_reminder',
            executionSource,
            providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
            idempotencyKey: remIdempotencyKey,
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
            scheduledFor: reminderSendAt,
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
      console.log(`[CommunicationScheduler] Skipping expired 24h reminder for ${inquiryId} (scheduled time was ${reminderSendAt.toISOString()})`);
    }

    // 3. Schedule Post-Event Feedback (Requires attendance check at execution time)
    const fbFeedback = await ensureFeedbackToken(inquiryId, event.id || event.slug, customerName);
    const fbIdempotencyKey = `FEEDBACK:${event.id || event.slug}:${registration._id}`;

    results.feedback = await WhatsappMessage.findOneAndUpdate(
      { idempotencyKey: fbIdempotencyKey },
      {
        $setOnInsert: {
          messageId: `WA-SCH-${crypto.randomBytes(8).toString('hex')}`,
          eventId: event.id || event.slug,
          registrationId: registration._id,
          inquiryId,
          recipientPhone: normalizePhoneNumber(phone),
          recipientMasked: maskPhoneNumber(phone),
          templateName: 'edkl_event_feedback_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'feedback_request',
          trigger: 'scheduled_post_event_feedback',
          executionSource,
          providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
          idempotencyKey: fbIdempotencyKey,
          status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
          scheduledFor: feedbackSendAt,
          templateParameters: {
            customerName,
            eventName,
            registrationId: inquiryId,
            feedbackToken: fbFeedback.token
          }
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return { success: true, schedules, results };
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
      const candidateJobs = await WhatsappMessage.find({
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
        scheduledFor: { $lte: currentNow }
      })
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

      // Check Meta Template approval status
      const templateStatus = await getCachedMetaTemplateStatus(job.templateName, job.templateLanguage || 'en_US');

      if (templateStatus && templateStatus !== 'APPROVED') {
        job.status = WHATSAPP_MESSAGE_STATUSES.BLOCKED_TEMPLATE_PENDING;
        job.lastErrorMessage = `Meta template '${job.templateName}' status is ${templateStatus}.`;
        await job.save();
        summary.blockedPendingTemplate++;
        continue;
      }

      // Dispatch message
      try {
        const sendResult = await sendUtilityTemplate({
          recipientPhone: job.recipientPhone,
          templateKey: job.templateName,
          languageCode: job.templateLanguage || 'en_US',
          variables: job.templateParameters,
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
