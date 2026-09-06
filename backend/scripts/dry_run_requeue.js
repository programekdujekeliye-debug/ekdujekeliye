import mongoose from 'mongoose';

async function preview() {
  await mongoose.connect((process.env.PROD_MONGO_URI || process.env.MONGO_URI));
  
  const Msg = mongoose.model('WhatsappMessage', new mongoose.Schema({}, { collection: 'whatsapp_messages', strict: false }));
  const Reg = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));

  const query = {
    status: { $in: ['FAILED', 'BLOCKED_TEST_MODE'] },
    templateName: { $ne: 'edkl_september_special_invite_v1' },
    trigger: { $ne: 'marketing_broadcast' },
    eventId: { $in: ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'] }
  };

  const docs = await Msg.find(query).lean();
  console.log(`Found ${docs.length} candidate messages to re-evaluate:\n`);

  let toQueueConfirmation = 0;
  let toQueueReminder = 0;
  let toQueuePending = 0;
  let toCancelStalePending = 0;

  for (const doc of docs) {
    const reg = await Reg.findOne({
      $or: [
        ...(doc.registrationId ? [{ _id: doc.registrationId }] : []),
        ...(doc.inquiryId ? [{ inquiryId: doc.inquiryId }] : [])
      ]
    }).lean();

    const isPaid = reg && (reg.status === 'approved' || reg.payment?.status === 'captured');
    const coupleName = reg ? `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() : 'Unknown';

    if (doc.messageType === 'payment_pending') {
      if (isPaid) {
        console.log(`[CANCEL STALE] ${doc.inquiryId} (${coupleName}): Already PAID -> Cancel stale payment reminder`);
        toCancelStalePending++;
      } else {
        console.log(`[QUEUE REMINDER] ${doc.inquiryId} (${coupleName}): Still PENDING -> Re-queue payment pending link`);
        toQueuePending++;
      }
    } else if (doc.messageType === 'payment_confirmation') {
      console.log(`[QUEUE CONFIRMATION] ${doc.inquiryId} (${coupleName}): PAID -> Re-queue pass confirmation`);
      toQueueConfirmation++;
    } else {
      console.log(`[QUEUE OTHER] ${doc.inquiryId} (${coupleName}): Type: ${doc.messageType}, Template: ${doc.templateName}`);
      toQueueReminder++;
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log('Payment Confirmations to re-queue:', toQueueConfirmation);
  console.log('Payment Pending Reminders to re-queue:', toQueuePending);
  console.log('Other reminders to re-queue:', toQueueReminder);
  console.log('Stale reminders to cancel (already paid):', toCancelStalePending);

  process.exit(0);
}

preview().catch(console.error);
