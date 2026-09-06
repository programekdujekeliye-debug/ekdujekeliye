import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  await mongoose.connect(PROD_MONGO_URI);

  const sampleVerified = await MediaArchive.find({
    status: 'VERIFIED',
    driveFileId: { $exists: true, $ne: null, $ne: '' }
  }).limit(10).lean();

  console.log('Sample 10 verified items:');
  sampleVerified.forEach(s => {
    console.log(`- Reg: ${s.registrationId} | Event: ${s.eventId} | DriveFileId: ${s.driveFileId} | SourcePublicId: ${s.sourcePublicId} | VerifiedAt: ${s.verifiedAt}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
