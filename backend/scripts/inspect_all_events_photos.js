import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';

const PROD_MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!PROD_MONGO_URI) {
  throw new Error('[SECURITY ERROR] MONGO_URI is not set. Please provide it via process.env.MONGO_URI.');
}

async function main() {
  await mongoose.connect(PROD_MONGO_URI);
  console.log('Connected to Production DB.');

  const events = await Event.find({}).sort({ date: 1 }).lean();

  console.log('\n--- ALL EVENTS BREAKDOWN ---');
  for (const ev of events) {
    const totalRegs = await Registration.countDocuments({
      programId: { $in: [ev.id, ev.slug].filter(Boolean) },
      isDeleted: { $ne: true }
    });

    const withPhoto = await Registration.countDocuments({
      programId: { $in: [ev.id, ev.slug].filter(Boolean) },
      isDeleted: { $ne: true },
      couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
    });

    const sampleReg = await Registration.findOne({
      programId: { $in: [ev.id, ev.slug].filter(Boolean) },
      isDeleted: { $ne: true },
      couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
    }).select('inquiryId couplePhoto paymentScreenshot').lean();

    const archives = await MediaArchive.find({ eventId: ev.id }).lean();
    const verifiedArchives = archives.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED');
    const withDriveId = archives.filter(a => Boolean(a.driveFileId));
    const cleanedCloudinary = archives.filter(a => a.cloudinaryOriginalStatus === 'DELETED');

    console.log(`\nEvent: [${ev.id}] "${ev.name}"`);
    console.log(`  Date: ${ev.date} | City: ${ev.city} | Status: ${ev.status} | ArchiveStatus: ${ev.archiveStatus}`);
    console.log(`  Registrations: ${totalRegs} | With Photos: ${withPhoto}`);
    console.log(`  MediaArchive: Total=${archives.length}, Verified=${verifiedArchives.length}, WithDriveId=${withDriveId.length}, Cleaned=${cleanedCloudinary.length}`);
    if (sampleReg) {
      console.log(`  Sample Reg [${sampleReg.inquiryId}]: couplePhoto = ${sampleReg.couplePhoto}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
