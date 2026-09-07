import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

function maskPhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}****${normalized.slice(-2)}`;
}

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to Prod MongoDB\n');

  const targetEventIds = ['prog-2026-09-11', 'prog-2026-09-19'];
  const now = new Date();
  let globalQueueIndex = 0;

  for (const eventId of targetEventIds) {
    const event = await Event.findOne({
      $or: [{ id: eventId }, { slug: eventId }]
    }).lean();

    if (!event) {
      console.warn(`Event ${eventId} not found!`);
      continue;
    }

    console.log(`\n======================================================`);
    console.log(`Processing Event: ${event.name} (${event.date}) - ID: ${event.id}`);
    console.log(`======================================================`);

    const eventAliases = [event.id, event.slug, event.date, event._id.toString()];

    // Fetch all approved/paid registrations
    const paidRegs = await Registration.find({
      programId: { $in: eventAliases },
      isDeleted: { $ne: true },
      $or: [
        { status: 'approved' },
        { 'payment.status': 'captured' }
      ]
    }).lean();

    console.log(`Found ${paidRegs.length} paid/approved registrations.`);

    let queuedCount = 0;
    let alreadySuccessCount = 0;

    for (const reg of paidRegs) {
      if (reg.whatsappOptOutAt) {
        console.log(`Skipping ${reg.inquiryId} - opted out of WhatsApp`);
        continue;
      }

      // Check if couple ALREADY received a Payment Confirmed pass
      const successMsg = await WhatsappMessage.findOne({
        inquiryId: reg.inquiryId,
        templateName: 'edkl_payment_confirmed_pass_v1',
        status: { $in: ['SENT', 'DELIVERED', 'READ'] }
      }).lean();

      if (successMsg) {
        alreadySuccessCount++;
        continue;
      }

      // Couple needs a Payment Confirmed pass!
      const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Respected Couple';
      const eventName = event.name || 'Ek Duje Ke Liye Seminar';
      const eventDate = event.date || '';
      const eventTime = event.time || '8:30 PM';
      const venue = event.venue || '';
      const phone = normalizePhoneNumber(reg.phoneNumber);

      const scheduledFor = new Date(now.getTime() + globalQueueIndex * 800);
      globalQueueIndex++;

      const templateParameters = {
        customerName,
        eventName,
        eventDate,
        eventTime,
        venue,
        registrationId: reg.inquiryId,
        inquiryId: reg.inquiryId
      };

      const existingMsg = await WhatsappMessage.findOne({
        inquiryId: reg.inquiryId,
        templateName: 'edkl_payment_confirmed_pass_v1'
      });

      if (existingMsg) {
        existingMsg.status = 'QUEUED';
        existingMsg.templateLanguage = 'en_US';
        existingMsg.scheduledFor = scheduledFor;
        existingMsg.lockedAt = null;
        existingMsg.attemptCount = 0;
        existingMsg.lastErrorCode = null;
        existingMsg.lastErrorMessage = null;
        existingMsg.providerErrorCode = null;
        existingMsg.providerErrorMessage = null;
        existingMsg.templateParameters = templateParameters;
        existingMsg.idempotencyKey = `RETRY:PAYMENT_CONFIRMED:${reg.inquiryId}:${Date.now()}_${globalQueueIndex}`;
        await existingMsg.save();
        console.log(`[RE-QUEUED] ${reg.inquiryId} (${customerName}) -> scheduledFor: ${scheduledFor.toISOString()}`);
      } else {
        const newMsg = new WhatsappMessage({
          messageId: `WA-SCH-${crypto.randomBytes(8).toString('hex')}`,
          eventId: event.id,
          registrationId: reg._id,
          inquiryId: reg.inquiryId,
          recipientPhone: phone,
          recipientMasked: maskPhoneNumber(phone),
          templateName: 'edkl_payment_confirmed_pass_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'payment_confirmation',
          trigger: 'payment_verified',
          executionSource: 'NORMAL',
          providerMode: 'META',
          idempotencyKey: `INSERT:PAYMENT_CONFIRMED:${reg.inquiryId}:${Date.now()}_${globalQueueIndex}`,
          status: 'QUEUED',
          scheduledFor,
          templateParameters
        });
        await newMsg.save();
        console.log(`[NEWLY QUEUED] ${reg.inquiryId} (${customerName}) -> scheduledFor: ${scheduledFor.toISOString()}`);
      }

      queuedCount++;
    }

    console.log(`\nEvent Summary:`);
    console.log(`- Already Successfully Sent/Delivered/Read: ${alreadySuccessCount}`);
    console.log(`- Queued for Smooth Dispatch (800ms staggered): ${queuedCount}`);
  }

  console.log(`\nTotal Messages Queued across all target events: ${globalQueueIndex}`);
  process.exit(0);
}

main().catch(console.error);
