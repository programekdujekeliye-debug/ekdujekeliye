import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function checkSubmissions() {
  await mongoose.connect(env.MONGO_URI);
  const coll = mongoose.connection.db.collection('submission');
  const sample = await coll.findOne({ inquiryId: 'EK05-721' });
  console.log('Sample EK05-721:', JSON.stringify(sample, null, 2));

  const sample2 = await coll.findOne({ inquiryId: 'IP-217' });
  console.log('Sample IP-217:', JSON.stringify(sample2, null, 2));

  await mongoose.disconnect();
}

checkSubmissions().catch(console.error);
