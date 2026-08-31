import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { ensureEarlyRegistrationEvents } from '../src/services/eventInit.service.js';

async function main() {
  console.log('Connecting to:', env.MONGO_URI);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected. Running ensureEarlyRegistrationEvents...');
  await ensureEarlyRegistrationEvents();
  console.log('ensureEarlyRegistrationEvents completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
