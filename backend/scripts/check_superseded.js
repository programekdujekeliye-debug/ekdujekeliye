import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  const failedMessages = await WhatsappMessage.find({
    eventId: { $in: ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'] },
    status: 'FAILED'
  }).lean();

  console.log(`Total Failed messages: ${failedMessages.length}`);

  let supersededCount = 0;
  let remainingFailed = 0;

  for (const m of failedMessages) {
    const newerSuccess = await WhatsappMessage.findOne({
      _id: { $ne: m._id },
      inquiryId: m.inquiryId,
      templateName: m.templateName,
      status: { $in: ['SENT', 'DELIVERED', 'READ'] }
    }).lean();

    if (newerSuccess) {
      supersededCount++;
      console.log(`Superseded: ${m.inquiryId} (${m.templateName}) -> succeeded in ${newerSuccess._id} (${newerSuccess.status})`);
    } else {
      remainingFailed++;
      console.log(`Still Failed: ${m.inquiryId} (${m.templateName}) -> Phone: ${m.recipientPhone}, Code: ${m.lastErrorCode}, Error: ${m.lastErrorMessage}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`Superseded (already successfully delivered on retry): ${supersededCount}`);
  console.log(`Still genuinely failing: ${remainingFailed}`);

  process.exit(0);
}

main().catch(console.error);
