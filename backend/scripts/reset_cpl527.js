import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function reset() {
  await mongoose.connect(env.MONGO_URI);
  await MediaArchive.updateOne({ registrationId: 'CPL-527' }, { $set: { status: 'QUEUED', workerId: null, claimedAt: null } });
  console.log('Reset CPL-527 to QUEUED');
  await mongoose.disconnect();
}
reset();
