import mongoose from 'mongoose';
import { ensureEarlyRegistrationEvents } from '../src/services/eventInit.service.js';

async function main() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  console.log('Connecting to production DB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('Running ensureEarlyRegistrationEvents on prod DB...');
  await ensureEarlyRegistrationEvents();
  console.log('ensureEarlyRegistrationEvents on prod DB completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
