import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  await mongoose.connect(PROD_MONGO_URI);

  const failedItems = await MediaArchive.find({ status: 'FAILED' }).lean();
  console.log(`Total FAILED items: ${failedItems.length}`);

  failedItems.forEach(f => {
    console.log(`- Reg: ${f.registrationId} | Event: ${f.eventId} | Error: "${f.lastError}" | SourceUrl: ${f.sourceUrl}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
