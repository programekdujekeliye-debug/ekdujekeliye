import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { env } from '../src/config/env.js';

async function check() {
  await mongoose.connect(env.MONGO_URI);
  const strictCount = await Registration.countDocuments({
    programId: 'prog-1785566789678',
    isDeleted: false,
    couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
  });
  const looseCount = await Registration.countDocuments({
    programId: 'prog-1785566789678',
    isDeleted: { $ne: true },
    couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
  });
  console.log('Strict count (isDeleted: false):', strictCount);
  console.log('Loose count (isDeleted: { $ne: true }):', looseCount);
  await mongoose.disconnect();
}
check();
