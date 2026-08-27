import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function isolateSingleTestJob() {
  await mongoose.connect(env.MONGO_URI);
  
  // Delete other records for prog-1785566789678 except CPL-559
  const deleteResult = await MediaArchive.deleteMany({
    eventId: 'prog-1785566789678',
    registrationId: { $ne: 'CPL-559' }
  });
  console.log('Removed unneeded records for 2026-08-09:', deleteResult.deletedCount);

  const tbdQueued = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'QUEUED' });
  const tbdVerified = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'VERIFIED' });
  const targetRecords = await MediaArchive.find({ eventId: 'prog-1785566789678' }).lean();

  console.log('\n--- VERIFIED MEDIA ARCHIVE STATE ---');
  console.log(`- Unrelated TBD Event (Untouched): ${tbdQueued} QUEUED / ${tbdVerified} VERIFIED`);
  console.log(`- Target Event (2026-08-09): ${targetRecords.length} Record(s)`);
  if (targetRecords.length === 1) {
    const job = targetRecords[0];
    console.log(`  * Single Job ID: ${job._id}`);
    console.log(`  * Registration ID: ${job.registrationId}`);
    console.log(`  * Status: ${job.status}`);
    console.log(`  * Filename: ${job.filename}`);
    console.log(`  * Source URL: ${job.sourceUrl}`);
    console.log(`  * Drive Folder Path: ${job.driveFolderPath}`);
  }

  await mongoose.disconnect();
}

isolateSingleTestJob();
