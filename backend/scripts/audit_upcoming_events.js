import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to Prod MongoDB\n');

  // Find all upcoming programs with date >= today
  const events = await Event.find({
    date: { $gte: '2026-09-07' }
  }).sort({ date: 1 }).lean();

  console.log(`Found ${events.length} upcoming events (>= 2026-09-07):`);
  for (const e of events) {
    console.log(`- [${e.date}] ${e.id} | Slug: ${e.slug} | Name: ${e.name} | Status: ${e.status}`);
  }

  for (const e of events) {
    console.log(`\n======================================================`);
    console.log(`EVENT: ${e.date} | ${e.name} (${e.id})`);
    console.log(`======================================================`);

    const eventAliases = [e.id, e.slug, e.date, e._id.toString()];

    // 1. Registrations
    const allRegs = await Registration.find({
      programId: { $in: eventAliases },
      isDeleted: { $ne: true }
    }).lean();

    const paidRegs = allRegs.filter(r => r.status === 'approved' || r.payment?.status === 'captured');
    const pendingRegs = allRegs.filter(r => r.status !== 'approved' && r.payment?.status !== 'captured');

    console.log(`Total Registrations: ${allRegs.length} (${paidRegs.length} Paid/Approved, ${pendingRegs.length} Pending)`);

    // 2. Check Payment Confirmed Pass (edkl_payment_confirmed_pass_v1)
    let paymentConfirmedSent = 0;
    let paymentConfirmedDelivered = 0;
    let paymentConfirmedRead = 0;
    let paymentConfirmedFailed = 0;
    let paymentConfirmedMissing = [];

    for (const r of paidRegs) {
      if (r.whatsappOptOutAt) continue;

      const msg = await WhatsappMessage.findOne({
        inquiryId: r.inquiryId,
        templateName: 'edkl_payment_confirmed_pass_v1'
      }).sort({ createdAt: -1 }).lean();

      if (!msg) {
        paymentConfirmedMissing.push({ inquiryId: r.inquiryId, name: `${r.husbandName} & ${r.wifeName}`, phone: r.phoneNumber });
      } else if (msg.status === 'READ') {
        paymentConfirmedRead++;
        paymentConfirmedDelivered++;
      } else if (msg.status === 'DELIVERED') {
        paymentConfirmedDelivered++;
      } else if (msg.status === 'SENT') {
        paymentConfirmedSent++;
      } else if (msg.status === 'FAILED') {
        paymentConfirmedFailed++;
      }
    }

    console.log(`\n--- Stage 1: Payment Confirmed Pass ---`);
    console.log(`Delivered/Read: ${paymentConfirmedDelivered} (Read: ${paymentConfirmedRead})`);
    console.log(`Sent (pending delivery): ${paymentConfirmedSent}`);
    console.log(`Failed: ${paymentConfirmedFailed}`);
    console.log(`Missing Payment Confirmation: ${paymentConfirmedMissing.length}`);
    if (paymentConfirmedMissing.length > 0) {
      console.log('Sample missing:', paymentConfirmedMissing.slice(0, 5));
    }

    // 3. Check 48h Reminder (edkl_event_pass_reminder_v2)
    const reminderMsgs = await WhatsappMessage.aggregate([
      {
        $match: {
          eventId: { $in: eventAliases },
          templateName: 'edkl_event_pass_reminder_v2'
        }
      },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log(`\n--- Stage 2: 48h Reminder Status ---`);
    console.log(reminderMsgs);

    // 4. Check 24h Personal Invitation (edkl_personal_invitation_24h_v2)
    const invitationMsgs = await WhatsappMessage.aggregate([
      {
        $match: {
          eventId: { $in: eventAliases },
          templateName: 'edkl_personal_invitation_24h_v2'
        }
      },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log(`\n--- Stage 3: 24h Invitation Status ---`);
    console.log(invitationMsgs);

    // 5. Check Media URLs in Registrations & Queued Messages
    const legacyMediaRegs = await Registration.countDocuments({
      programId: { $in: eventAliases },
      $or: [
        { couplePhoto: { $regex: 'media.ekdujekeliye.in' } },
        { invitationCardUrl: { $regex: 'media.ekdujekeliye.in' } }
      ]
    });
    console.log(`\nRegistrations with legacy media.ekdujekeliye.in URLs: ${legacyMediaRegs}`);

    const legacyMediaMsgs = await WhatsappMessage.countDocuments({
      eventId: { $in: eventAliases },
      status: 'QUEUED',
      $or: [
        { 'templateParameters.headerImageUrl': { $regex: 'media.ekdujekeliye.in' } },
        { 'templateParameters.imageUrl': { $regex: 'media.ekdujekeliye.in' } },
        { 'templateParameters.invitationImageUrl': { $regex: 'media.ekdujekeliye.in' } }
      ]
    });
    console.log(`Queued messages with legacy media.ekdujekeliye.in URLs: ${legacyMediaMsgs}`);

    // Check language of queued messages
    const queuedGuLang = await WhatsappMessage.countDocuments({
      eventId: { $in: eventAliases },
      status: 'QUEUED',
      templateLanguage: 'gu'
    });
    console.log(`Queued messages with incorrect 'gu' language: ${queuedGuLang}`);
  }

  process.exit(0);
}

main().catch(console.error);
