import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function run() {
  await mongoose.connect(env.MONGO_URI);
  console.log(`Connected to database: ${env.DATABASE_NAME} (${env.DATABASE_ENV})`);

  const OLD_DOMAIN = 'https://media.ekdujekeliye.in';
  const NEW_DOMAIN = 'https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev';

  // 1. Check Registrations
  const regCount = await Registration.countDocuments({
    invitationCardUrl: { $regex: OLD_DOMAIN }
  });
  console.log(`Registrations with old domain: ${regCount}`);

  if (regCount > 0) {
    const regs = await Registration.find({ invitationCardUrl: { $regex: OLD_DOMAIN } });
    for (const r of regs) {
      r.invitationCardUrl = r.invitationCardUrl.replace(OLD_DOMAIN, NEW_DOMAIN);
      await r.save();
    }
    console.log(`Successfully migrated ${regCount} registration invitationCardUrls to ${NEW_DOMAIN}`);
  }

  // 2. Check WhatsappMessages
  const msgCount = await WhatsappMessage.countDocuments({
    'templateParameters.headerImageUrl': { $regex: OLD_DOMAIN }
  });
  console.log(`WhatsappMessages with old domain: ${msgCount}`);

  if (msgCount > 0) {
    const msgs = await WhatsappMessage.find({ 'templateParameters.headerImageUrl': { $regex: OLD_DOMAIN } });
    for (const m of msgs) {
      if (m.templateParameters?.headerImageUrl) {
        m.templateParameters.headerImageUrl = m.templateParameters.headerImageUrl.replace(OLD_DOMAIN, NEW_DOMAIN);
      }
      if (m.templateParameters?.imageUrl) {
        m.templateParameters.imageUrl = m.templateParameters.imageUrl.replace(OLD_DOMAIN, NEW_DOMAIN);
      }
      if (m.templateParameters?.invitationImageUrl) {
        m.templateParameters.invitationImageUrl = m.templateParameters.invitationImageUrl.replace(OLD_DOMAIN, NEW_DOMAIN);
      }
      m.markModified('templateParameters');
      await m.save();
    }
    console.log(`Successfully migrated ${msgCount} WhatsappMessage URLs to ${NEW_DOMAIN}`);
  }

  console.log('Migration complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
