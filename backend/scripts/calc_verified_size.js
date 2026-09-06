import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  await mongoose.connect(PROD_MONGO_URI);

  const verified = await MediaArchive.find({
    status: { $in: ['VERIFIED', 'ARCHIVED'] },
    driveFileId: { $exists: true, $ne: null, $ne: '' }
  }).lean();

  const realVerified = verified.filter(v => 
    !v.driveFileId.startsWith('1AbCdEfGh') && 
    !v.driveFileId.toLowerCase().includes('mock')
  );

  const totalBytes = realVerified.reduce((sum, v) => sum + (v.originalSize || 0), 0);
  console.log(`Real verified items: ${realVerified.length}`);
  console.log(`Total original bytes recorded: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);

  // Let's also check sample sourcePublicIds
  console.log('\nSample 5 sourcePublicIds:');
  realVerified.slice(0, 5).forEach(v => {
    console.log(`- ${v.registrationId}: sourcePublicId="${v.sourcePublicId}", sourceUrl="${v.sourceUrl}"`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
