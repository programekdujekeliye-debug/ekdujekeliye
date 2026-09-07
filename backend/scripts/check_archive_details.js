import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

const uri = process.env.PROD_MONGO_URI || env.MONGO_URI;

async function checkDetails() {
  await mongoose.connect(uri);

  const total = await MediaArchive.countDocuments({});
  const verified = await MediaArchive.countDocuments({ status: { $in: ['VERIFIED', 'ARCHIVED'] } });
  const withThumb = await MediaArchive.countDocuments({ operationalThumbnailUrl: { $ne: null } });
  
  console.log({ total, verified, withThumb });

  const breakdownByEvent = await MediaArchive.aggregate([
    {
      $group: {
        _id: '$eventId',
        total: { $sum: 1 },
        verified: { $sum: { $cond: [{ $in: ['$status', ['VERIFIED', 'ARCHIVED']] }, 1, 0] } },
        withThumb: { $sum: { $cond: [{ $ne: ['$operationalThumbnailUrl', null] }, 1, 0] } },
        cldActive: { $sum: { $cond: [{ $ne: ['$cloudinaryOriginalStatus', 'DELETED'] }, 1, 0] } }
      }
    }
  ]);
  console.log('Breakdown by event:', breakdownByEvent);

  // Sample 5 verified archives
  const samples = await MediaArchive.find({ status: { $in: ['VERIFIED', 'ARCHIVED'] } }).limit(5).lean();
  for (const s of samples) {
    console.log('Sample:', {
      regId: s.registrationId,
      eventId: s.eventId,
      driveFileId: s.driveFileId,
      operationalThumbnailUrl: s.operationalThumbnailUrl,
      sourceUrl: s.sourceUrl,
      cloudinaryOriginalStatus: s.cloudinaryOriginalStatus
    });
    // Test if sourceUrl is still alive on Cloudinary
    if (s.sourceUrl) {
      try {
        const cldRes = await fetch(s.sourceUrl, { method: 'HEAD' });
        console.log(`  Cloudinary sourceUrl HTTP: ${cldRes.status}`);
      } catch (e) {
        console.log(`  Cloudinary sourceUrl fetch error: ${e.message}`);
      }
    }
    if (s.operationalThumbnailUrl) {
      try {
        const thumbRes = await fetch(s.operationalThumbnailUrl, { method: 'HEAD' });
        console.log(`  operationalThumbnailUrl HTTP: ${thumbRes.status}`);
      } catch (e) {
        console.log(`  operationalThumbnailUrl fetch error: ${e.message}`);
      }
    }
  }

  await mongoose.disconnect();
}

checkDetails().catch(console.error);
