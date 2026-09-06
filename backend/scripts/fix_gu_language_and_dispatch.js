import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../src/models/WhatsappMessage.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';

async function run() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log(`Connected to production database: ${mongoose.connection.name}`);

  // 1. Fix templateLanguage from 'gu' to 'en_US'
  const fixRes = await WhatsappMessage.updateMany(
    {
      templateName: 'edkl_personal_invitation_24h_v2',
      templateLanguage: { $ne: 'en_US' }
    },
    {
      $set: {
        templateLanguage: 'en_US',
        languageCode: 'en_US',
        lastErrorCode: null,
        lastErrorMessage: null
      }
    }
  );
  console.log(`Updated ${fixRes.modifiedCount} records to templateLanguage: 'en_US'`);

  // 2. Unlock any stuck SENDING messages
  const unlockRes = await WhatsappMessage.updateMany(
    {
      status: 'SENDING',
      templateName: 'edkl_personal_invitation_24h_v2'
    },
    {
      $set: {
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
        lockedAt: null
      }
    }
  );
  console.log(`Unlocked ${unlockRes.modifiedCount} stuck SENDING messages back to QUEUED`);

  // 3. Count remaining due for prog-2026-09-07
  const now = new Date();
  const dueCount = await WhatsappMessage.countDocuments({
    status: 'QUEUED',
    templateName: 'edkl_personal_invitation_24h_v2',
    eventId: 'prog-2026-09-07',
    scheduledFor: { $lte: now }
  });
  console.log(`Due 24h invitations ready for immediate dispatch: ${dueCount}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
