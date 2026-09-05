import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority');

  const events = await Event.find({}).sort({ sequenceNumber: 1 }).lean();
  console.log('--- ALL EVENTS IN DB ---');
  for (const e of events) {
    const regCount = await Registration.countDocuments({
      programId: { $in: [e.id, e.slug].filter(Boolean) },
      isDeleted: { $ne: true }
    });
    const photoRegCount = await Registration.countDocuments({
      programId: { $in: [e.id, e.slug].filter(Boolean) },
      isDeleted: { $ne: true },
      couplePhoto: { $exists: true, $ne: null, $ne: '', $not: /sample_couple/ }
    });
    const archiveCount = await MediaArchive.countDocuments({ eventId: e.id });
    const verifiedCount = await MediaArchive.countDocuments({ eventId: e.id, status: { $in: ['VERIFIED', 'ARCHIVED'] } });
    const driveCount = await MediaArchive.countDocuments({ eventId: e.id, driveFileId: { $exists: true, $ne: null, $ne: '' } });
    const cleanedCount = await MediaArchive.countDocuments({ eventId: e.id, cloudinaryOriginalStatus: 'DELETED' });

    console.log(`Event ${e.sequenceNumber || '?'}: ${e.id} (${e.date})`);
    console.log(`  Name: ${e.name}`);
    console.log(`  Regs: ${regCount} total | Photos: ${photoRegCount}`);
    console.log(`  Archives: ${archiveCount} | Verified: ${verifiedCount} | In Drive: ${driveCount} | Cloudinary Cleaned: ${cleanedCount}`);
    console.log(`  Status: ${e.status} | ArchiveStatus: ${e.archiveStatus}`);
    console.log('----------------------------------------------------');
  }

  const totalArchives = await MediaArchive.countDocuments({});
  const totalVerified = await MediaArchive.countDocuments({ status: { $in: ['VERIFIED', 'ARCHIVED'] } });
  const totalDrive = await MediaArchive.countDocuments({ driveFileId: { $exists: true, $ne: null, $ne: '' } });
  const totalCleaned = await MediaArchive.countDocuments({ cloudinaryOriginalStatus: 'DELETED' });

  console.log('\nOVERALL MEDIA ARCHIVES:');
  console.log(`Total: ${totalArchives} | Verified: ${totalVerified} | In Google Drive: ${totalDrive} | Cleaned from Cloudinary: ${totalCleaned}`);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
