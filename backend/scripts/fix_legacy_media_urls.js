import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to MongoDB');

  // 1. Update any registrations with media.ekdujekeliye.in
  const legacyRegs = await Registration.find({
    $or: [
      { couplePhoto: { $regex: 'media.ekdujekeliye.in' } },
      { invitationCardUrl: { $regex: 'media.ekdujekeliye.in' } },
      { paymentScreenshot: { $regex: 'media.ekdujekeliye.in' } }
    ]
  });

  console.log(`Found ${legacyRegs.length} registrations with legacy media.ekdujekeliye.in URLs`);
  for (const reg of legacyRegs) {
    let modified = false;
    if (reg.couplePhoto && reg.couplePhoto.includes('media.ekdujekeliye.in')) {
      reg.couplePhoto = reg.couplePhoto.replace('https://media.ekdujekeliye.in', 'https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev');
      modified = true;
    }
    if (reg.invitationCardUrl && reg.invitationCardUrl.includes('media.ekdujekeliye.in')) {
      reg.invitationCardUrl = reg.invitationCardUrl.replace('https://media.ekdujekeliye.in', 'https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev');
      modified = true;
    }
    if (reg.paymentScreenshot && reg.paymentScreenshot.includes('media.ekdujekeliye.in')) {
      reg.paymentScreenshot = reg.paymentScreenshot.replace('https://media.ekdujekeliye.in', 'https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev');
      modified = true;
    }
    if (modified) {
      await reg.save();
      console.log(`Migrated registration ${reg.inquiryId}`);
    }
  }

  // 2. Update any WhatsApp messages with media.ekdujekeliye.in
  const legacyMsgs = await WhatsappMessage.find({
    $or: [
      { 'templateParameters.headerImageUrl': { $regex: 'media.ekdujekeliye.in' } },
      { 'templateParameters.imageUrl': { $regex: 'media.ekdujekeliye.in' } },
      { 'templateParameters.invitationImageUrl': { $regex: 'media.ekdujekeliye.in' } }
    ]
  });

  console.log(`Found ${legacyMsgs.length} WhatsApp messages with legacy media.ekdujekeliye.in URLs`);
  for (const msg of legacyMsgs) {
    let modified = false;
    ['headerImageUrl', 'imageUrl', 'invitationImageUrl'].forEach(k => {
      if (msg.templateParameters?.[k]?.includes('media.ekdujekeliye.in')) {
        msg.templateParameters[k] = msg.templateParameters[k].replace('https://media.ekdujekeliye.in', 'https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev');
        modified = true;
      }
    });
    if (modified) {
      msg.markModified('templateParameters');
      await msg.save();
      console.log(`Migrated message ${msg._id} (${msg.inquiryId})`);
    }
  }

  console.log('Legacy media migration completed.');
  process.exit(0);
}

main().catch(console.error);
