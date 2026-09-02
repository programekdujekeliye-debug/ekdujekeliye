import crypto from 'crypto';
import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../models/WhatsappMessage.js';
import { normalizePhoneNumber, env } from '../config/env.js';
import { maskPhoneNumber } from '../integrations/whatsapp/whatsapp.service.js';
import { logger } from '../utils/logger.js';

export const runPaymentReminders = async () => {
  logger.info('[Payment Reminders Job] Scanning for pending unpaid registrations eligible for automated reminders...');
  const now = Date.now();
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

  // 1. Fetch active events where payment & communications are currently ENABLED
  const activeEvents = await Event.find({
    isPaymentEnabled: true,
    earlyRegistrationMode: { $ne: true },
    communicationsEnabled: { $ne: false },
    status: { $nin: ['archived', 'completed', 'cancelled'] }
  }).lean();

  if (activeEvents.length === 0) {
    logger.info('[Payment Reminders Job] No events currently have online payment & communications active. Reminders suppressed.');
    return { processedCount: 0, queuedReminders: 0 };
  }

  const activeEventMap = new Map(activeEvents.map(e => [e.id, e]));
  const activeEventIds = activeEvents.map(e => e.id);

  // 2. Fetch pending unpaid registrations created >= 10 minutes ago
  const pendingSubmissions = await Registration.find({
    programId: { $in: activeEventIds },
    status: 'pending',
    'payment.status': { $ne: 'captured' },
    createdAt: { $lte: tenMinutesAgo },
    isDeleted: { $ne: true }
  }).limit(100);

  let queuedCount = 0;

  for (const reg of pendingSubmissions) {
    const event = activeEventMap.get(reg.programId);
    if (!event || !reg.phoneNumber || String(reg.phoneNumber).trim().length < 10) continue;

    const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Valued Couple';
    const eventName = event.name || '';
    const eventDate = event.date || '';
    const eventTime = event.time || '8:30 PM';
    const venue = event.venue || '';
    const feeAmount = `₹${event.price !== undefined ? event.price : 1500}`;
    const inquiryId = reg.inquiryId;

    // Check if registration was created after payment opened (New Registration Cohort)
    const paymentOpenedAt = event.paymentOpenedAt ? new Date(event.paymentOpenedAt).getTime() : 0;
    const regCreatedAt = new Date(reg.createdAt).getTime();

    // Reminder #1: 10-Minute Reminder (For new registrations >= 10m old)
    if (regCreatedAt >= paymentOpenedAt || !event.paymentOpenedAt) {
      const tenMinKey = `REMINDER_10M:${event.id}:${reg._id}`;
      const existing10m = await WhatsappMessage.findOne({ idempotencyKey: tenMinKey }).select('_id status').lean();

      if (!existing10m) {
        await WhatsappMessage.create({
          messageId: `WA-REM10-${crypto.randomBytes(8).toString('hex')}`,
          eventId: event.id,
          registrationId: reg._id,
          inquiryId,
          recipientPhone: normalizePhoneNumber(reg.phoneNumber),
          recipientMasked: maskPhoneNumber(reg.phoneNumber),
          templateName: 'edkl_payment_pending_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'payment_pending',
          trigger: 'payment_reminder_10m',
          executionSource: 'NORMAL',
          providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
          idempotencyKey: tenMinKey,
          status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
          scheduledFor: new Date(),
          templateParameters: {
            customerName,
            eventName,
            registrationId: inquiryId,
            eventDate,
            eventTime,
            venue,
            feeAmount,
            inquiryId
          }
        });
        queuedCount++;
        continue;
      }
    }

    // Reminder #2: 24-Hour Reminder (For unpaid registrations >= 24h old)
    if (new Date(reg.createdAt) <= twentyFourHoursAgo) {
      const twentyFourHourKey = `REMINDER_24H:${event.id}:${reg._id}`;
      const existing24h = await WhatsappMessage.findOne({ idempotencyKey: twentyFourHourKey }).select('_id status').lean();

      if (!existing24h) {
        await WhatsappMessage.create({
          messageId: `WA-REM24-${crypto.randomBytes(8).toString('hex')}`,
          eventId: event.id,
          registrationId: reg._id,
          inquiryId,
          recipientPhone: normalizePhoneNumber(reg.phoneNumber),
          recipientMasked: maskPhoneNumber(reg.phoneNumber),
          templateName: 'edkl_payment_pending_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'payment_pending',
          trigger: 'payment_reminder_24h',
          executionSource: 'NORMAL',
          providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
          idempotencyKey: twentyFourHourKey,
          status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
          scheduledFor: new Date(),
          templateParameters: {
            customerName,
            eventName,
            registrationId: inquiryId,
            eventDate,
            eventTime,
            venue,
            feeAmount,
            inquiryId
          }
        });
        queuedCount++;
      }
    }
  }

  logger.info(`[Payment Reminders Job] Scanned ${pendingSubmissions.length} registrations. Queued ${queuedCount} new reminder messages.`);
  return {
    processedCount: pendingSubmissions.length,
    queuedReminders: queuedCount
  };
};
