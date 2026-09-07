import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  const failedMessages = await WhatsappMessage.find({
    eventId: { $in: ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'] },
    status: 'FAILED',
    templateName: 'edkl_personal_invitation_24h_v2'
  }).lean();

  console.log(`Checking ${failedMessages.length} failed 24h messages...`);

  let alreadyDeliveredOrRead = 0;
  let alreadySent = 0;
  let trulyFailed = 0;

  const genuinelyFailed = [];

  for (const m of failedMessages) {
    const newerSuccess = await WhatsappMessage.findOne({
      inquiryId: m.inquiryId,
      templateName: 'edkl_personal_invitation_24h_v2',
      status: { $in: ['SENT', 'DELIVERED', 'READ'] }
    }).lean();

    if (newerSuccess) {
      if (newerSuccess.status === 'READ' || newerSuccess.status === 'DELIVERED') {
        alreadyDeliveredOrRead++;
      } else {
        alreadySent++;
      }
      console.log(`[ALREADY DELIVERED/SENT] ${m.inquiryId} - newer message ${newerSuccess._id} is ${newerSuccess.status}`);
    } else {
      trulyFailed++;
      const reg = await Registration.findOne({ inquiryId: m.inquiryId }).lean();
      genuinelyFailed.push({
        inquiryId: m.inquiryId,
        coupleName: reg ? `${reg.husbandName} & ${reg.wifeName}` : 'Unknown',
        phone: m.recipientPhone,
        code: m.lastErrorCode,
        error: m.lastErrorMessage
      });
      console.log(`[TRULY FAILED] ${m.inquiryId} - phone: ${m.recipientPhone}, error: ${m.lastErrorCode} ${m.lastErrorMessage}`);
    }
  }

  console.log('\n--- BREAKDOWN ---');
  console.log(`Already Delivered/Read on retry: ${alreadyDeliveredOrRead}`);
  console.log(`Already Sent (accepted by Meta): ${alreadySent}`);
  console.log(`Truly Failed (Still not delivered): ${trulyFailed}`);
  console.log('\nTruly Failed details:');
  console.log(JSON.stringify(genuinelyFailed, null, 2));

  process.exit(0);
}

main().catch(console.error);
