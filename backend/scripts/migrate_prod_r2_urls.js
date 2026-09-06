import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../src/models/WhatsappMessage.js';

async function run() {
  if (!env.PROD_MONGO_URI) {
    console.error('PROD_MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  console.log('Connecting to PRODUCTION database via PROD_MONGO_URI...');
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log(`Connected to production database: ${mongoose.connection.name}`);

  const OLD_DOMAIN = 'https://media.ekdujekeliye.in';
  const NEW_DOMAIN = 'https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev';

  // 1. Check Registrations
  const regCount = await Registration.countDocuments({
    invitationCardUrl: { $regex: 'media.ekdujekeliye.in' }
  });
  console.log(`[PROD] Registrations with media.ekdujekeliye.in: ${regCount}`);

  if (regCount > 0) {
    const res = await Registration.collection.updateMany(
      { invitationCardUrl: { $regex: 'media.ekdujekeliye.in' } },
      [
        {
          $set: {
            invitationCardUrl: {
              $replaceOne: {
                input: '$invitationCardUrl',
                find: OLD_DOMAIN,
                replacement: NEW_DOMAIN
              }
            }
          }
        }
      ]
    );
    console.log(`[PROD] Successfully updated ${res.modifiedCount} registration invitationCardUrls!`);
  }

  // 2. Check WhatsappMessages with invalid URI or old domain
  const msgCount = await WhatsappMessage.countDocuments({
    'templateParameters.headerImageUrl': { $regex: 'media.ekdujekeliye.in' }
  });
  console.log(`[PROD] WhatsappMessages with media.ekdujekeliye.in: ${msgCount}`);

  if (msgCount > 0) {
    const resMsg = await WhatsappMessage.collection.updateMany(
      { 'templateParameters.headerImageUrl': { $regex: 'media.ekdujekeliye.in' } },
      [
        {
          $set: {
            'templateParameters.headerImageUrl': {
              $replaceOne: {
                input: '$templateParameters.headerImageUrl',
                find: OLD_DOMAIN,
                replacement: NEW_DOMAIN
              }
            },
            'templateParameters.imageUrl': {
              $replaceOne: {
                input: '$templateParameters.imageUrl',
                find: OLD_DOMAIN,
                replacement: NEW_DOMAIN
              }
            },
            'templateParameters.invitationImageUrl': {
              $replaceOne: {
                input: '$templateParameters.invitationImageUrl',
                find: OLD_DOMAIN,
                replacement: NEW_DOMAIN
              }
            }
          }
        }
      ]
    );
    console.log(`[PROD] Successfully updated ${resMsg.modifiedCount} WhatsappMessage image URLs!`);
  }

  // 3. Check failed messages with (#100) invalid URI for event 2026-09-07 and reset them to QUEUED with fresh timestamp spacing
  const failed24hCount = await WhatsappMessage.countDocuments({
    templateName: 'edkl_personal_invitation_24h_v2',
    status: { $in: ['FAILED', 'QUEUED'] },
    lastErrorMessage: { $regex: 'Param template.components.parameters.image.link is not a valid URI' }
  });
  console.log(`[PROD] Failed 24h invitations with invalid URI error: ${failed24hCount}`);

  if (failed24hCount > 0) {
    const failedMessages = await WhatsappMessage.find({
      templateName: 'edkl_personal_invitation_24h_v2',
      status: 'FAILED',
      lastErrorMessage: { $regex: 'Param template.components.parameters.image.link is not a valid URI' }
    });

    const now = new Date();
    let resetCount = 0;
    for (let i = 0; i < failedMessages.length; i++) {
      const msg = failedMessages[i];
      // Schedule with 800ms spacing
      const scheduledTime = new Date(now.getTime() + i * 800);
      let newHeaderUrl = msg.templateParameters?.headerImageUrl || '';
      if (newHeaderUrl.includes(OLD_DOMAIN)) {
        newHeaderUrl = newHeaderUrl.replace(OLD_DOMAIN, NEW_DOMAIN);
      }

      await WhatsappMessage.updateOne(
        { _id: msg._id },
        {
          $set: {
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
            scheduledFor: scheduledTime,
            attemptCount: 0,
            lastErrorCode: null,
            lastErrorMessage: null,
            providerErrorCode: null,
            providerErrorMessage: null,
            'templateParameters.headerImageUrl': newHeaderUrl,
            'templateParameters.imageUrl': newHeaderUrl,
            'templateParameters.invitationImageUrl': newHeaderUrl
          }
        }
      );
      resetCount++;
    }
    console.log(`[PROD] Successfully reset ${resetCount} failed 24h invitations to QUEUED with valid Cloudflare URLs and 800ms spacing!`);
  }

  console.log('[PROD] All migration and cleanup tasks completed successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error('[PROD] Migration error:', err);
  process.exit(1);
});
