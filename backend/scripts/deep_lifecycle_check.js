import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function checkEvent(eventId, label) {
  const event = await Event.findOne({
    $or: [{ id: eventId }, { slug: eventId }]
  }).lean();

  if (!event) {
    console.log(`Event ${eventId} not found!`);
    return;
  }

  const eventAliases = [event.id, event.slug, event.date, event._id.toString()];

  console.log(`\n================================================================`);
  console.log(`📍 EVENT: ${label} | Date: ${event.date} | Venue: ${event.venue}`);
  console.log(`   Event ID: ${event.id} | Slug: ${event.slug}`);
  console.log(`================================================================`);

  // 1. Registrations
  const allRegs = await Registration.find({
    programId: { $in: eventAliases },
    isDeleted: { $ne: true }
  }).lean();

  const paidRegs = allRegs.filter(r => r.status === 'approved' || r.payment?.status === 'captured');
  const pendingRegs = allRegs.filter(r => r.status !== 'approved' && r.payment?.status !== 'captured');

  console.log(`\n📊 1. REGISTRATIONS BREAKDOWN:`);
  console.log(`   - Total Registrations: ${allRegs.length}`);
  console.log(`   - Confirmed / Paid: ${paidRegs.length}`);
  console.log(`   - Payment Pending: ${pendingRegs.length}`);

  // 2. Stage 1: Payment Confirmed Pass
  let payDelivered = 0, paySent = 0, payQueued = 0, payFailed = 0, payMissing = [];
  for (const r of paidRegs) {
    if (r.whatsappOptOutAt) continue;
    const msg = await WhatsappMessage.findOne({
      inquiryId: r.inquiryId,
      templateName: 'edkl_payment_confirmed_pass_v1'
    }).sort({ createdAt: -1 }).lean();

    if (!msg) {
      payMissing.push({ inquiryId: r.inquiryId, name: `${r.husbandName} & ${r.wifeName}`, phone: r.phoneNumber });
    } else if (msg.status === 'DELIVERED' || msg.status === 'READ') {
      payDelivered++;
    } else if (msg.status === 'SENT') {
      paySent++;
    } else if (msg.status === 'QUEUED') {
      payQueued++;
    } else if (msg.status === 'FAILED') {
      payFailed++;
    }
  }

  console.log(`\n🎟️  2. STAGE 1: PAYMENT CONFIRMED + PASS:`);
  console.log(`   - Delivered & Read: ${payDelivered}`);
  console.log(`   - Sent (waiting Meta delivery receipt): ${paySent}`);
  console.log(`   - Queued (ready for delivery): ${payQueued}`);
  console.log(`   - Failed: ${payFailed}`);
  console.log(`   - Not Scheduled / Missing: ${payMissing.length}`);
  if (payMissing.length > 0) {
    console.log(`   - Note on Missing: ${payMissing.slice(0, 3).map(m => m.inquiryId).join(', ')} (mostly VIP/internal passes or late additions)`);
  }

  // 3. Stage 2: 48-Hour Pass Reminder
  const reminder48h = await WhatsappMessage.aggregate([
    { $match: { eventId: { $in: eventAliases }, templateName: 'edkl_event_pass_reminder_v2' } },
    { $group: { _id: '$status', count: { $sum: 1 }, minDate: { $min: '$scheduledFor' }, maxDate: { $max: '$scheduledFor' } } }
  ]);

  console.log(`\n⏰ 3. STAGE 2: 48-HOUR PASS REMINDER:`);
  if (reminder48h.length === 0) {
    console.log(`   - No 48h reminders found (past event window or not yet queued)`);
  } else {
    for (const st of reminder48h) {
      console.log(`   - Status: ${st._id} | Count: ${st.count} | Schedule Time: ${st.minDate ? new Date(st.minDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
    }
  }

  // 4. Stage 3: 24-Hour Personal Invitation with Card
  const invite24h = await WhatsappMessage.aggregate([
    { $match: { eventId: { $in: eventAliases }, templateName: 'edkl_personal_invitation_24h_v2' } },
    { $group: { _id: '$status', count: { $sum: 1 }, minDate: { $min: '$scheduledFor' }, maxDate: { $max: '$scheduledFor' } } }
  ]);

  console.log(`\n💌 4. STAGE 3: 24-HOUR PERSONAL INVITATION (IMAGE HEADER):`);
  for (const st of invite24h) {
    console.log(`   - Status: ${st._id} | Count: ${st.count} | Schedule Time: ${st.minDate ? new Date(st.minDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
  }

  // Check card health for 24h invitation
  const queuedInvites = await WhatsappMessage.find({
    eventId: { $in: eventAliases },
    templateName: 'edkl_personal_invitation_24h_v2',
    status: 'QUEUED'
  }).limit(5).lean();

  if (queuedInvites.length > 0) {
    console.log(`   - Sample Queued 24h Invitation:`);
    console.log(`     • Inquiry: ${queuedInvites[0].inquiryId}`);
    console.log(`     • Template Language: ${queuedInvites[0].templateLanguage}`);
    console.log(`     • Card Image URL: ${queuedInvites[0].templateParameters?.invitationImageUrl || queuedInvites[0].templateParameters?.headerImageUrl}`);
    console.log(`     • Scheduled At: ${new Date(queuedInvites[0].scheduledFor).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  }

  // 5. Stage 4: Post Event
  const postEvent = await WhatsappMessage.aggregate([
    { $match: { eventId: { $in: eventAliases }, templateName: 'edkl_post_event_memories_feedback_v1' } },
    { $group: { _id: '$status', count: { $sum: 1 }, minDate: { $min: '$scheduledFor' } } }
  ]);

  console.log(`\n📸 5. STAGE 4: POST-EVENT (PHOTOS & FEEDBACK):`);
  for (const st of postEvent) {
    console.log(`   - Status: ${st._id} | Count: ${st.count} | Scheduled: ${st.minDate ? new Date(st.minDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Waiting post-event'}`);
  }
}

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to Prod MongoDB');

  await checkEvent('prog-2026-09-07', 'Surat • 7 September 2026 (TODAY)');
  await checkEvent('prog-2026-09-11', 'Surat • 11 September 2026 (UPCOMING)');
  await checkEvent('prog-2026-09-19', 'Bhavnagar • 19 September 2026 (UPCOMING)');

  process.exit(0);
}

main().catch(console.error);
