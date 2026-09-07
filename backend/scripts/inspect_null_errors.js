import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  const nullCodeMessages = await WhatsappMessage.find({
    status: 'FAILED',
    templateName: 'edkl_personal_invitation_24h_v2',
    lastErrorCode: null
  }).lean();

  console.log(`Found ${nullCodeMessages.length} messages with null error code`);
  for (const m of nullCodeMessages) {
    const reg = await Registration.findOne({ inquiryId: m.inquiryId }).lean();
    console.log({
      inquiryId: m.inquiryId,
      recipientPhone: m.recipientPhone,
      cardUrl: reg?.cardUrl,
      invitationCardUrl: reg?.invitationCardUrl,
      templateData: m.templateData,
      templateLanguage: m.templateLanguage,
      attemptCount: m.attemptCount
    });
  }

  process.exit(0);
}

main().catch(console.error);
