import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  const statusCounts = await WhatsappMessage.aggregate([
    { $match: { templateName: 'edkl_personal_invitation_24h_v2' } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('24h Invitation Status Breakdown:', statusCounts);

  const recent = await WhatsappMessage.find({
    templateName: 'edkl_personal_invitation_24h_v2'
  })
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  console.log('Recent 8 24h messages:');
  for (const m of recent) {
    console.log(`- ${m.inquiryId} | ${m.status} | sentAt: ${m.sentAt} | updated: ${m.updatedAt} | error: ${m.lastErrorMessage || 'none'}`);
  }

  process.exit(0);
}

main().catch(console.error);
