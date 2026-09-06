import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function run() {
  await mongoose.connect(env.PROD_MONGO_URI);
  const now = new Date();
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sentLast24h = await WhatsappMessage.countDocuments({
    status: { $in: ['SENT', 'DELIVERED', 'READ'] },
    sentAt: { $gte: past24h }
  });
  console.log('Total sent across all templates in last 24 hours:', sentLast24h);

  const totalForEvent = await WhatsappMessage.countDocuments({
    status: 'QUEUED',
    templateName: 'edkl_personal_invitation_24h_v2',
    eventId: 'prog-2026-09-07'
  });
  const dueForEvent = await WhatsappMessage.countDocuments({
    status: 'QUEUED',
    templateName: 'edkl_personal_invitation_24h_v2',
    eventId: 'prog-2026-09-07',
    scheduledFor: { $lte: now }
  });
  const notDueForEvent = await WhatsappMessage.countDocuments({
    status: 'QUEUED',
    templateName: 'edkl_personal_invitation_24h_v2',
    eventId: 'prog-2026-09-07',
    scheduledFor: { $gt: now }
  });

  console.log('Total for prog-2026-09-07:', totalForEvent);
  console.log('Due for prog-2026-09-07 (scheduledFor <= now):', dueForEvent);
  console.log('Scheduled for FUTURE for prog-2026-09-07:', notDueForEvent);

  const errors = await WhatsappMessage.aggregate([
    { $match: { status: 'FAILED', templateName: 'edkl_personal_invitation_24h_v2' } },
    { $group: { _id: { code: '$lastErrorCode', msg: '$lastErrorMessage' }, count: { $sum: 1 } } }
  ]);
  console.log('Errors on 24h invitations:', errors);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
