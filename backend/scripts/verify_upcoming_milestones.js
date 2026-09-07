import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  for (const eventId of ['prog-2026-09-11', 'prog-2026-09-19']) {
    console.log(`\nVerifying Queued Milestones for ${eventId}:`);

    // 48h reminders
    const reminders = await WhatsappMessage.countDocuments({
      eventId,
      templateName: 'edkl_event_pass_reminder_v2',
      status: 'QUEUED'
    });
    console.log(`- 48h Pass Reminders Queued: ${reminders}`);

    // 24h invitations
    const invitations = await WhatsappMessage.find({
      eventId,
      templateName: 'edkl_personal_invitation_24h_v2',
      status: 'QUEUED'
    }).lean();
    console.log(`- 24h Personal Invitations Queued: ${invitations.length}`);

    // Check language of invitations
    const nonEnUsLang = invitations.filter(m => m.templateLanguage !== 'en_US');
    console.log(`- Invitations with non-en_US language: ${nonEnUsLang.length}`);

    // Check headerImageUrl on invitations
    let missingOrBrokenImage = 0;
    for (const inv of invitations) {
      const imgUrl = inv.templateParameters?.headerImageUrl || inv.templateParameters?.invitationImageUrl || inv.templateParameters?.imageUrl;
      if (!imgUrl || !imgUrl.startsWith('https://')) {
        missingOrBrokenImage++;
      }
    }
    console.log(`- Invitations with missing/invalid image URL: ${missingOrBrokenImage}`);
  }

  process.exit(0);
}

main().catch(console.error);
