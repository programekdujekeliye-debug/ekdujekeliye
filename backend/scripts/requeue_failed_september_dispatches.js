import mongoose from 'mongoose';

async function run() {
  console.log('[Requeue Script] Connecting to production database...');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('[SECURITY ERROR] MONGO_URI is required.');
  }
  await mongoose.connect(mongoUri);
  
  const Msg = mongoose.model('WhatsappMessage', new mongoose.Schema({}, { collection: 'whatsapp_messages', strict: false }));
  const Reg = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));

  const query = {
    status: { $in: ['FAILED', 'BLOCKED_TEST_MODE'] },
    templateName: { $ne: 'edkl_september_special_invite_v1' },
    trigger: { $ne: 'marketing_broadcast' },
    eventId: { $in: ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'] }
  };

  const docs = await Msg.find(query);
  console.log(`[Requeue Script] Found ${docs.length} failed messages to process.`);

  let requeuedCount = 0;
  let cancelledStaleCount = 0;
  const now = new Date();

  for (let i = 0; i < docs.length; i++) {
    const msg = docs[i];

    // Check if registration is already paid
    const reg = await Reg.findOne({
      $or: [
        ...(msg.registrationId ? [{ _id: msg.registrationId }] : []),
        ...(msg.inquiryId ? [{ inquiryId: msg.inquiryId }] : [])
      ]
    }).lean();

    const isPaid = reg && (reg.status === 'approved' || reg.payment?.status === 'captured');

    if (msg.messageType === 'payment_pending' && isPaid) {
      await Msg.updateOne(
        { _id: msg._id },
        {
          $set: {
            status: 'CANCELLED',
            lastErrorMessage: 'Registration already paid. Stale payment reminder cancelled.'
          }
        }
      );
      console.log(`- CANCELLED stale reminder for paid registration: ${msg.inquiryId}`);
      cancelledStaleCount++;
      continue;
    }

    // Re-queue with 250ms spacing
    await Msg.updateOne(
      { _id: msg._id },
      {
        $set: {
          status: 'QUEUED',
          scheduledFor: new Date(now.getTime() + requeuedCount * 250),
          lockedAt: null,
          attemptCount: 0,
          providerErrorCode: null,
          providerErrorMessage: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          idempotencyKey: `RETRY:${msg.templateName || msg.messageType}:${msg.inquiryId || msg.recipientPhone}:${Date.now()}_${requeuedCount}`
        }
      }
    );
    console.log(`- RE-QUEUED [${msg.messageType}] for ${msg.inquiryId} (${msg.recipientPhone})`);
    requeuedCount++;
  }

  console.log(`\n[Requeue Script] Done! Successfully re-queued ${requeuedCount} messages, cancelled ${cancelledStaleCount} stale reminders.`);
  process.exit(0);
}

run().catch(err => {
  console.error('[Requeue Script Error]:', err);
  process.exit(1);
});
