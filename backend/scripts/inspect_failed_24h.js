import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to Prod MongoDB');

  // Find all failed messages for this event slot
  const failedMessages = await WhatsappMessage.find({
    eventId: { $in: ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'] },
    status: 'FAILED',
    templateName: 'edkl_personal_invitation_24h_v2'
  }).lean();

  console.log(`Total Failed 24h invitations: ${failedMessages.length}`);

  const errorSummary = {};
  for (const m of failedMessages) {
    const key = `${m.lastErrorCode || 'NO_CODE'} | ${m.lastErrorMessage || 'NO_MESSAGE'}`;
    errorSummary[key] = (errorSummary[key] || 0) + 1;
  }
  console.log('\n--- Error Summary Breakdown ---');
  console.log(JSON.stringify(errorSummary, null, 2));

  console.log('\n--- Individual Failed Records ---');
  for (const m of failedMessages) {
    const reg = await Registration.findOne({ inquiryId: m.inquiryId }).lean();
    console.log({
      inquiryId: m.inquiryId,
      coupleName: reg ? `${reg.husbandName || ''} & ${reg.wifeName || ''}` : 'Unknown',
      phone: m.recipientPhone,
      errorCode: m.lastErrorCode,
      errorMessage: m.lastErrorMessage,
      attemptCount: m.attemptCount,
      lastAttemptAt: m.lastAttemptAt || m.updatedAt
    });
  }

  // Also check if there are any other failed messages across any template for this event
  const allFailedForEvent = await WhatsappMessage.find({
    eventId: { $in: ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'] },
    status: 'FAILED'
  }).lean();
  console.log(`\nTotal Failed messages across ALL templates for this slot: ${allFailedForEvent.length}`);

  const allSummary = {};
  for (const m of allFailedForEvent) {
    const key = `${m.templateName} -> ${m.lastErrorCode || 'NO_CODE'}: ${m.lastErrorMessage || 'NO_MESSAGE'}`;
    allSummary[key] = (allSummary[key] || 0) + 1;
  }
  console.log(JSON.stringify(allSummary, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
