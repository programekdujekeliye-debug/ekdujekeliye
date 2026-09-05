import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { WhatsappMessage } from '../models/WhatsappMessage.js';
import { sendUtilityTemplate } from '../integrations/whatsapp/whatsapp.service.js';
import { ensureFeedbackToken } from '../modules/feedback/feedback.controller.js';
import { invitationCardService } from '../services/invitationCard.service.js';
import { env } from '../config/env.js';

/**
 * Helper to parse event date and time into Asia/Kolkata Date object
 */
export function getEventDateTime(dateStr, timeStr = '8:30 PM') {
  if (!dateStr || dateStr === 'TBA' || dateStr === 'TBD') return null;

  // Parse dateStr (e.g. 2026-09-15)
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;

  let hour = 20;
  let minute = 30;

  // Parse timeStr (e.g. 8:30 PM or 08:30 PM)
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (match) {
    let parsedHour = Number(match[1]);
    const parsedMin = Number(match[2]);
    const ampm = (match[3] || '').toUpperCase();

    if (ampm === 'PM' && parsedHour < 12) parsedHour += 12;
    if (ampm === 'AM' && parsedHour === 12) parsedHour = 0;

    hour = parsedHour;
    minute = parsedMin;
  }

  // Construct ISO string for Asia/Kolkata (+05:30)
  const pad = (n) => String(n).padStart(2, '0');
  const isoStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`;
  return new Date(isoStr);
}

/**
 * Main WhatsApp Lifecycle Communication Worker
 */
export async function runAutomaticWhatsAppWorker() {
  console.log('====================================================');
  console.log(`[WhatsApp Worker] Running Customer Communication Lifecycle at ${new Date().toISOString()}...`);
  console.log('====================================================');

  const now = new Date();
  let processedCount = 0;

  // 1. Process QUEUED Outbound Messages
  const queuedMessages = await WhatsappMessage.find({ status: 'QUEUED' }).limit(50);
  for (const msg of queuedMessages) {
    console.log(`[WhatsApp Worker] Retrying QUEUED message: ${msg.messageId} (${msg.templateName})`);
    try {
      const res = await sendUtilityTemplate({
        recipientPhone: msg.recipientPhone,
        templateKey: msg.templateName,
        languageCode: msg.templateLanguage,
        variables: msg.templateParameters,
        idempotencyKey: msg.idempotencyKey,
        registrationId: msg.registrationId,
        eventId: msg.eventId,
        inquiryId: msg.inquiryId,
        trigger: msg.trigger
      });
      if (res.success) processedCount++;
    } catch (e) {
      console.warn(`[WhatsApp Worker] Error retrying message ${msg.messageId}:`, e.message);
    }
  }

  // 2. Scan Active Events for 48h Invitation, 24h Reminder, and Post-Event Reviews
  const activeEvents = await Event.find({ status: { $nin: ['archived', 'completed'] } });

  for (const ev of activeEvents) {
    const eventStartAt = getEventDateTime(ev.date, ev.time);
    if (!eventStartAt) continue;

    const msUntilEvent = eventStartAt.getTime() - now.getTime();
    const hoursUntilEvent = msUntilEvent / (1000 * 60 * 60);

    const eventName = ev.name || 'Ek Duje Ke Liye Seminar';
    const eventDate = ev.date;
    const eventTime = ev.time || '8:30 PM';
    const venue = ev.venue || 'Event Venue';

    // -------------------------------------------------------------
    // M5: 48-Hour Personalized Invitation Card (Window: 40h - 52h before)
    // -------------------------------------------------------------
    if (hoursUntilEvent > 40 && hoursUntilEvent <= 52) {
      console.log(`[WhatsApp Worker] Event '${ev.name}' is in 48h window (${hoursUntilEvent.toFixed(1)}h). Scanning confirmed couples...`);

      const confirmedRegistrations = await Registration.find({
        programId: ev.id,
        status: 'approved',
        isDeleted: { $ne: true },
        whatsappOptOutAt: null
      });

      for (const reg of confirmedRegistrations) {
        const idempotencyKey = `INVITATION_48H:${ev.id}:${reg.inquiryId}:v1`;
        const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Guest';

        const res = await sendUtilityTemplate({
          recipientPhone: reg.phoneNumber,
          templateKey: 'edkl_event_pass_reminder_v2',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName,
            eventDate,
            eventTime,
            venue,
            registrationId: reg.inquiryId,
            inquiryId: reg.inquiryId
          },
          idempotencyKey,
          registrationId: reg._id,
          eventId: ev.id,
          inquiryId: reg.inquiryId,
          trigger: 'invitation_48h'
        });

        if (res.success && res.status === 'SENT') processedCount++;
      }
    }

    // -------------------------------------------------------------
    // M6: 24-Hour Event Reminder (Window: 18h - 30h before)
    // -------------------------------------------------------------
    if (hoursUntilEvent > 18 && hoursUntilEvent <= 30) {
      console.log(`[WhatsApp Worker] Event '${ev.name}' is in 24h window (${hoursUntilEvent.toFixed(1)}h). Scanning confirmed couples...`);

      const confirmedRegistrations = await Registration.find({
        programId: ev.id,
        status: 'approved',
        isDeleted: { $ne: true },
        whatsappOptOutAt: null
      });

      for (const reg of confirmedRegistrations) {
        const idempotencyKey = `REMINDER_24H:${ev.id}:${reg.inquiryId}`;
        const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Guest';

        let headerImageUrl = reg.invitationCardUrl;
        if (!headerImageUrl) {
          try {
            const cardRes = await invitationCardService.ensureInvitationCardImage(reg, ev);
            headerImageUrl = cardRes?.cardUrl;
          } catch (err) {
            console.warn(`[WhatsApp Worker] Failed to render card for ${reg.inquiryId}:`, err.message);
          }
        }
        if (!headerImageUrl) {
          headerImageUrl = reg.couplePhoto || 'https://www.ekdujekeliye.in/sample_couple.png';
        }

        const res = await sendUtilityTemplate({
          recipientPhone: reg.phoneNumber,
          templateKey: 'edkl_personal_invitation_24h_v2',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName,
            eventDate,
            eventTime,
            venue,
            registrationId: reg.inquiryId,
            inquiryId: reg.inquiryId,
            headerImageUrl
          },
          idempotencyKey,
          registrationId: reg._id,
          eventId: ev.id,
          inquiryId: reg.inquiryId,
          trigger: 'reminder_24h'
        });

        if (res.success && res.status === 'SENT') processedCount++;
      }
    }

    // -------------------------------------------------------------
    // M7: Post-Event Review / Feedback (Window: 2h - 24h after event end)
    // -------------------------------------------------------------
    const hoursAfterEvent = -hoursUntilEvent;
    if (hoursAfterEvent >= 2 && hoursAfterEvent <= 24) {
      console.log(`[WhatsApp Worker] Event '${ev.name}' completed ${hoursAfterEvent.toFixed(1)}h ago. Dispatching attendee feedback requests...`);

      const attendees = await Registration.find({
        programId: ev.id,
        status: 'approved',
        isDeleted: { $ne: true },
        attendance: 'present',
        whatsappOptOutAt: null
      });

      for (const reg of attendees) {
        const idempotencyKey = `REVIEW:${ev.id}:${reg.inquiryId}`;
        const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Guest';

        const feedback = await ensureFeedbackToken(reg.inquiryId, ev.id, customerName);

        const res = await sendUtilityTemplate({
          recipientPhone: reg.phoneNumber,
          templateKey: 'edkl_post_event_memories_feedback_v1',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName,
            eventDate,
            eventTime,
            venue,
            registrationId: reg.inquiryId,
            inquiryId: reg.inquiryId
          },
          idempotencyKey,
          registrationId: reg._id,
          eventId: ev.id,
          inquiryId: reg.inquiryId,
          trigger: 'review_post_event'
        });

        if (res.success && res.status === 'SENT') processedCount++;
      }
    }
  }

  console.log(`[WhatsApp Worker] Cycle completed. Processed/Dispatched: ${processedCount} messages.`);
  return { processedCount };
}
