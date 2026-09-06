import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { mediaService } from '../src/modules/media/media.service.js';

const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, val] = arg.replace(/^--/, '').split('=');
      args[key] = val !== undefined ? val : true;
    }
  });
  return args;
};

async function audit() {
  const args = parseArgs();
  const isProd = Boolean(args.prod);
  const targetUri = isProd
    ? (process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || process.env.MONGO_URI)
    : (process.env.MONGO_URI || env.MONGO_URI);

  console.log(`Connecting to ${isProd ? 'PRODUCTION' : 'TEST'} DB...`);
  await mongoose.connect(targetUri);

  const upcomingEvents = [
    { name: '7 September (EK06)', eventId: 'prog-2026-09-07', date: '2026-09-07' },
    { name: '11 September (EK07)', eventId: 'prog-2026-09-11', date: '2026-09-11' },
    { name: '19 September (EK08)', eventId: 'prog-2026-09-19', date: '2026-09-19' }
  ];

  for (const ev of upcomingEvents) {
    console.log(`\n======================================================`);
    console.log(`AUDIT FOR EVENT: ${ev.name} [${ev.eventId}]`);
    console.log(`======================================================`);

    const registrations = await Registration.find({
      $or: [
        { programId: ev.eventId },
        { programDate: ev.date },
        { inquiryId: new RegExp(`^EK0${ev.name.match(/EK0(\d)/)?.[1] || '6'}-`, 'i') }
      ],
      isDeleted: { $ne: true }
    }).sort({ inquiryId: 1 }).lean();

    console.log(`Total active registrations: ${registrations.length}`);

    let countPrivateR2 = 0;
    let countPublicR2 = 0;
    let countCloudinary = 0;
    let countNoPhoto = 0;
    let countBroken = 0;

    const needsMigration = [];
    const missingPhotos = [];

    for (const reg of registrations) {
      const rawPhoto = reg.couplePhoto || '';
      const r2Media = reg.r2Media;

      if ((!rawPhoto && !r2Media?.key) || rawPhoto === '/sample_couple.png' || rawPhoto.includes('sample_couple.png')) {
        countNoPhoto++;
        missingPhotos.push(reg.inquiryId);
        continue;
      }

      if (r2Media?.isPrivate) {
        countPrivateR2++;
      } else if (r2Media && !r2Media.isPrivate && r2Media.key) {
        countPublicR2++;
      } else if (rawPhoto.includes('cloudinary.com')) {
        countCloudinary++;
        needsMigration.push({ inquiryId: reg.inquiryId, rawPhoto });
      } else {
        countBroken++;
        console.log(`  [BROKEN] ${reg.inquiryId}: rawPhoto=${rawPhoto}, r2Media=${JSON.stringify(r2Media)}`);
      }
    }

    console.log(`- Private R2 couple photos: ${countPrivateR2}`);
    console.log(`- Public R2 couple photos:  ${countPublicR2} (MUST BE 0!)`);
    console.log(`- Cloudinary fallback:      ${countCloudinary}`);
    console.log(`- No photo uploaded:        ${countNoPhoto} (${missingPhotos.join(', ') || 'None'})`);
    console.log(`- Broken references:        ${countBroken}`);

    if (needsMigration.length > 0) {
      console.log(`- Registrations still in Cloudinary needing migration (${needsMigration.length}):`);
      needsMigration.forEach(m => console.log(`    ${m.inquiryId}`));
    }
  }

  await mongoose.disconnect();
}

audit().catch(console.error);
