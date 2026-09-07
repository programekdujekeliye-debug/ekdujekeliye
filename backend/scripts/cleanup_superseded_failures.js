import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to MongoDB');

  const failedMessages = await WhatsappMessage.find({
    eventId: { $in: ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'] },
    status: 'FAILED'
  }).lean();

  console.log(`Found ${failedMessages.length} failed messages to evaluate...`);

  let cancelledCount = 0;
  for (const m of failedMessages) {
    const newerSuccess = await WhatsappMessage.findOne({
      _id: { $ne: m._id },
      inquiryId: m.inquiryId,
      templateName: m.templateName,
      status: { $in: ['SENT', 'DELIVERED', 'READ'] }
    }).lean();

    if (newerSuccess) {
      await WhatsappMessage.updateOne(
        { _id: m._id },
        {
          $set: {
            status: 'CANCELLED',
            lastErrorMessage: `Superseded: Successfully dispatched via message ${newerSuccess._id} (${newerSuccess.status}).`
          }
        }
      );
      cancelledCount++;
      console.log(`Cancelled superseded failed record for ${m.inquiryId} (${m.templateName}) -> replaced by ${newerSuccess.status}`);
    }
  }

  console.log(`\nCleaned up ${cancelledCount} superseded records.`);

  // Check remaining failed messages
  const remaining = await WhatsappMessage.find({
    eventId: { $in: ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'] },
    status: 'FAILED'
  }).lean();
  console.log(`\nRemaining truly failed messages in slot: ${remaining.length}`);
  for (const r of remaining) {
    console.log(`- ${r.inquiryId}: ${r.recipientPhone} | ${r.templateName} | Error: ${r.lastErrorMessage}`);
  }

  process.exit(0);
}

main().catch(console.error);
