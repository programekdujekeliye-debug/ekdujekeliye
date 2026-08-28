import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
});

async function inspect() {
  await mongoose.connect(env.MONGO_URI);
  console.log('=== EVENTS IN DB ===');
  const events = await Event.find().lean();
  for (const ev of events) {
    const totalReg = await Registration.countDocuments({ programId: ev.id, isDeleted: { $ne: true } });
    const eligiblePhotos = await Registration.countDocuments({
      programId: ev.id,
      isDeleted: { $ne: true },
      couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
    });
    const archives = await MediaArchive.find({ eventId: ev.id }).lean();
    const queued = archives.filter(a => a.status === 'QUEUED').length;
    const copying = archives.filter(a => a.status === 'COPYING').length;
    const verified = archives.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED').length;
    const failed = archives.filter(a => a.status === 'FAILED').length;
    console.log(`\nEvent: "${ev.name}" | Date: ${ev.date} | ID: ${ev.id}`);
    console.log(`  Status: ${ev.status} | ArchiveStatus: ${ev.archiveStatus}`);
    console.log(`  Registrations: ${totalReg} | Eligible Photos: ${eligiblePhotos} | Archives Total: ${archives.length}`);
    console.log(`  QUEUED: ${queued} | COPYING: ${copying} | VERIFIED: ${verified} | FAILED: ${failed}`);
  }

  console.log('\n=== CLOUDINARY USAGE STATS ===');
  try {
    const usage = await cloudinary.api.usage();
    console.log('Cloudinary Plan:', usage.plan);
    console.log('Storage Usage:', usage.storage);
    console.log('Credits Usage:', usage.credits);
    console.log('Transformations:', usage.transformations);
  } catch (e) {
    console.log('Could not fetch Cloudinary usage:', e.message);
  }

  await mongoose.disconnect();
}

inspect();
