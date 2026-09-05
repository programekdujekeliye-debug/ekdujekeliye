import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

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
