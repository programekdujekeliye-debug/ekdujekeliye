import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { invitationCardService } from '../src/services/invitationCard.service.js';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority');

  console.log('Fetching approved registrations for upcoming events...');
  const registrations = await Registration.find({
    programId: { $in: ['prog-2026-09-07', 'prog-2026-09-11'] },
    status: 'approved',
    isDeleted: { $ne: true }
  });

  console.log(`Found ${registrations.length} approved registrations.`);

  // Load event maps
  const events = await Event.find({ id: { $in: ['prog-2026-09-07', 'prog-2026-09-11'] } }).lean();
  const eventMap = new Map();
  events.forEach(e => eventMap.set(e.id, e));

  let cardsGenerated = 0;
  let cardsSkipped = 0;
  let cardErrors = 0;

  const CONCURRENCY = 8;
  for (let i = 0; i < registrations.length; i += CONCURRENCY) {
    const chunk = registrations.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (reg, idx) => {
      const globalIdx = i + idx + 1;
      const event = eventMap.get(reg.programId);

      if (!event || (!event.cardTemplate && !event.cardTemplateUrl)) {
        cardsSkipped++;
        return;
      }

      if (reg.invitationCardUrl && reg.invitationCardUrl.includes('invitation-cards/')) {
        cardsSkipped++;
        return;
      }

      try {
        const cardRes = await invitationCardService.ensureInvitationCardImage(reg, event);
        if (cardRes && cardRes.cardUrl) {
          reg.invitationCardUrl = cardRes.cardUrl;
          await reg.save();
          cardsGenerated++;
          console.log(`[${globalIdx}/${registrations.length}] Generated card for ${reg.inquiryId}: ${reg.husbandName} & ${reg.wifeName}`);
        } else {
          cardsSkipped++;
        }
      } catch (err) {
        console.warn(`Error generating card for ${reg.inquiryId}:`, err.message);
        cardErrors++;
      }
    }));
  }

  console.log(`\nCard Generation Completed: ${cardsGenerated} generated, ${cardsSkipped} already had cards / skipped, ${cardErrors} errors.`);

  console.log('\nScanning and updating queued invitation messages...');
  const queuedMessages = await WhatsappMessage.find({
    templateName: 'edkl_personal_invitation_24h_v2',
    status: { $in: ['QUEUED', 'PENDING', 'WAITING'] }
  });

  console.log(`Found ${queuedMessages.length} queued invitation messages.`);
  let messagesUpdated = 0;
  let messagesAlreadyUpdated = 0;

  for (const msg of queuedMessages) {
    const header = msg.templateParameters?.headerImageUrl || '';
    if (header.includes('invitation-cards/')) {
      messagesAlreadyUpdated++;
      continue;
    }

    // Lookup registration
    const inquiryId = msg.inquiryId || msg.templateParameters?.inquiryId;
    const reg = await Registration.findOne({
      $or: [
        ...(inquiryId ? [{ inquiryId }] : []),
        ...(msg.registrationId ? [{ _id: msg.registrationId }] : [])
      ]
    });

    if (reg && reg.invitationCardUrl) {
      msg.templateParameters = {
        ...(msg.templateParameters || {}),
        headerImageUrl: reg.invitationCardUrl,
        imageUrl: reg.invitationCardUrl,
        invitationImageUrl: reg.invitationCardUrl
      };
      msg.markModified('templateParameters');
      await msg.save();
      messagesUpdated++;
    }
  }

  console.log(`Queued Messages Update Completed: ${messagesUpdated} updated to rendered card, ${messagesAlreadyUpdated} already had card.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
