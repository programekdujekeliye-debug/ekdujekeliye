import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  // All approved/paid registrations for 2026-09-07
  const paidRegs = await Registration.find({
    programId: { $in: ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'] },
    isDeleted: { $ne: true },
    $or: [
      { status: 'approved' },
      { 'payment.status': 'captured' }
    ]
  }).lean();

  console.log(`Total Paid Registrations for 2026-09-07: ${paidRegs.length}`);

  let deliveredCount = 0;
  let readCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let queuedCount = 0;
  let notScheduledCount = 0;
  let optedOutCount = 0;

  const missingOrFailed = [];

  for (const reg of paidRegs) {
    if (reg.whatsappOptOutAt) {
      optedOutCount++;
      continue;
    }

    const msg = await WhatsappMessage.findOne({
      inquiryId: reg.inquiryId,
      templateName: 'edkl_personal_invitation_24h_v2'
    }).sort({ createdAt: -1 }).lean();

    if (!msg) {
      notScheduledCount++;
      missingOrFailed.push({ inquiryId: reg.inquiryId, name: `${reg.husbandName} & ${reg.wifeName}`, phone: reg.phoneNumber, status: 'NOT_SCHEDULED' });
    } else if (msg.status === 'READ') {
      readCount++;
      deliveredCount++;
    } else if (msg.status === 'DELIVERED') {
      deliveredCount++;
    } else if (msg.status === 'SENT') {
      sentCount++;
    } else if (msg.status === 'FAILED') {
      failedCount++;
      missingOrFailed.push({ inquiryId: reg.inquiryId, name: `${reg.husbandName} & ${reg.wifeName}`, phone: reg.phoneNumber, status: 'FAILED', error: msg.lastErrorMessage, code: msg.lastErrorCode });
    } else if (msg.status === 'QUEUED' || msg.status === 'SENDING') {
      queuedCount++;
    }
  }

  console.log('\n--- 24H INVITATION RECONCILIATION ---');
  console.log(`Delivered (including Read): ${deliveredCount}`);
  console.log(`Read: ${readCount}`);
  console.log(`Sent (awaiting delivery receipt from Meta): ${sentCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Queued / Sending: ${queuedCount}`);
  console.log(`Not Scheduled: ${notScheduledCount}`);
  console.log(`WhatsApp Opted Out: ${optedOutCount}`);
  console.log(`Total Accounted For: ${deliveredCount + sentCount + failedCount + queuedCount + notScheduledCount + optedOutCount}`);

  if (missingOrFailed.length > 0) {
    console.log(`\nList of Missing or Failed (${missingOrFailed.length} records):`);
    console.log(JSON.stringify(missingOrFailed, null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
