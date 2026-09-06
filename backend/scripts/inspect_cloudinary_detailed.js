import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const PROD_MONGO_URI = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  await mongoose.connect(PROD_MONGO_URI);
  console.log('Connected to Production MongoDB.');

  // 1. Check Cloudinary Usage API
  console.log('\n--- CLOUDINARY USAGE STATS ---');
  try {
    const usage = await cloudinary.api.usage();
    console.log('Plan:', usage.plan);
    console.log('Credits:', usage.credits);
    console.log('Storage:', (usage.storage.usage / (1024 * 1024)).toFixed(2), 'MB');
    console.log('Bandwidth:', (usage.bandwidth.usage / (1024 * 1024 * 1024)).toFixed(2), 'GB');
    console.log('Objects/Resources:', usage.resources);
  } catch (err) {
    console.error('Failed to get Cloudinary usage:', err.message);
  }

  // 2. Sample resources per folder in Cloudinary
  console.log('\n--- ASSETS PER FOLDER IN CLOUDINARY ---');
  const folders = ['couplePhotos', 'invitation-cards', 'event-assets', 'event-templates', 'paymentScreenshots', 'archive-thumbnails'];
  for (const folder of folders) {
    try {
      const res = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: 5
      });
      console.log(`Folder "${folder}": sample count fetched = ${res.resources.length}, next_cursor = ${Boolean(res.next_cursor)}`);
      if (res.resources.length > 0) {
        console.log(`  Sample ID: ${res.resources[0].public_id}, bytes: ${res.resources[0].bytes}, created_at: ${res.resources[0].created_at}`);
      }
    } catch (err) {
      console.error(`Folder "${folder}" error:`, err.message);
    }
  }

  // 3. Inspect MediaArchives in Production DB
  console.log('\n--- MEDIA ARCHIVE SUMMARY IN PROD DB ---');
  const archivesByEvent = await MediaArchive.aggregate([
    {
      $group: {
        _id: { eventId: '$eventId', status: '$status', originalStatus: '$cloudinaryOriginalStatus' },
        count: { $sum: 1 },
        withDriveId: {
          $sum: {
            $cond: [{ $and: [{ $ne: ['$driveFileId', null] }, { $ne: ['$driveFileId', ''] }] }, 1, 0]
          }
        }
      }
    },
    { $sort: { '_id.eventId': 1 } }
  ]);
  console.table(archivesByEvent.map(a => ({
    eventId: a._id.eventId,
    status: a._id.status,
    cloudinaryOriginal: a._id.originalStatus,
    count: a.count,
    withDriveId: a.withDriveId
  })));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
