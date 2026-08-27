import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function inspectAndReset() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.');

  // Find all COPYING jobs
  const copyingJobs = await MediaArchive.find({ status: 'COPYING' }).lean();
  console.log(`Found ${copyingJobs.length} job(s) in COPYING status.`);

  for (const job of copyingJobs) {
    console.log(`- Job: ${job._id} | Reg: ${job.registrationId} | Worker: ${job.workerId} | DriveFileId: ${job.driveFileId || 'NONE'}`);
    
    // If not copied to drive, reset safely to QUEUED
    if (!job.driveFileId && !job.verifiedAt) {
      await MediaArchive.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'QUEUED',
            workerId: null,
            claimedAt: null
          }
        }
      );
      console.log(`  -> Reset job ${job._id} back to QUEUED.`);
    }
  }

  // Find summary
  const queued = await MediaArchive.countDocuments({ status: 'QUEUED' });
  const copying = await MediaArchive.countDocuments({ status: 'COPYING' });
  const verified = await MediaArchive.countDocuments({ status: 'VERIFIED' });
  const failed = await MediaArchive.countDocuments({ status: 'FAILED' });

  console.log(`\nUpdated Archive Status Breakdown:`);
  console.log(`- QUEUED: ${queued}`);
  console.log(`- COPYING: ${copying}`);
  console.log(`- VERIFIED: ${verified}`);
  console.log(`- FAILED: ${failed}`);

  await mongoose.disconnect();
}

inspectAndReset();
