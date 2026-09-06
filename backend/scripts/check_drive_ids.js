import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  await mongoose.connect(PROD_MONGO_URI);

  const allWithDrive = await MediaArchive.find({
    driveFileId: { $exists: true, $ne: null, $ne: '' }
  }).lean();

  console.log(`Total records with driveFileId: ${allWithDrive.length}`);

  let realDriveIds = 0;
  let mockDriveIds = 0;
  const byEvent = {};

  allWithDrive.forEach(doc => {
    const isMock = !doc.driveFileId || 
                   doc.driveFileId.startsWith('1AbCdEfGh') || 
                   doc.driveFileId.toLowerCase().includes('mock') || 
                   doc.driveFileId.toLowerCase().includes('test');
    
    if (isMock) {
      mockDriveIds++;
    } else {
      realDriveIds++;
      byEvent[doc.eventId] = (byEvent[doc.eventId] || 0) + 1;
    }
  });

  console.log(`Real Drive IDs: ${realDriveIds}`);
  console.log(`Mock/Test Drive IDs: ${mockDriveIds}`);
  console.log('Real Drive IDs by Event:', byEvent);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
