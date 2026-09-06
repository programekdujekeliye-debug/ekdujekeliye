import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI));

  const regs = await Registration.find({
    programId: { $in: ['prog-2026-09-07', 'prog-2026-09-11'] },
    status: 'approved',
    isDeleted: { $ne: true }
  }).select('inquiryId husbandName wifeName surname phoneNumber isVip invitationCardUrl couplePhoto programId').lean();

  console.log('Approved registrations count for upcoming events:', regs.length);
  for (const r of regs) {
    console.log(r.inquiryId, r.husbandName, '&', r.wifeName, '| VIP:', r.isVip, '| Card URL:', r.invitationCardUrl ? r.invitationCardUrl.substring(0, 60) + '...' : 'NONE', '| Photo:', Boolean(r.couplePhoto));
  }

  const queuedInvites = await WhatsappMessage.find({
    templateName: 'edkl_personal_invitation_24h_v2',
    status: { $in: ['QUEUED', 'PENDING', 'WAITING'] }
  }).select('inquiryId templateName status scheduledFor templateParameters').lean();

  let couplePhotoCount = 0;
  let cardCount = 0;
  let otherCount = 0;

  for (const q of queuedInvites) {
    const url = q.templateParameters?.headerImageUrl || '';
    if (url.includes('couplePhotos') || url.includes('_couple')) {
      couplePhotoCount++;
    } else if (url.includes('invitation-cards') || url.includes('invitation_')) {
      cardCount++;
    } else {
      otherCount++;
    }
  }

  console.log('Queued Invites Total:', queuedInvites.length);
  console.log(' - Using Raw Couple Photo (couplePhotos):', couplePhotoCount);
  console.log(' - Using Rendered Card (invitation-cards):', cardCount);
  console.log(' - Other / Fallback:', otherCount);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
