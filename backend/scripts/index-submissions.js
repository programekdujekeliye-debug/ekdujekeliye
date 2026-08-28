import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function indexSubmissions() {
  await mongoose.connect(env.MONGO_URI);
  const coll = mongoose.connection.db.collection('submission');
  const existingIndexes = await coll.indexes();
  console.log('Existing indexes on submission:', JSON.stringify(existingIndexes, null, 2));

  console.log('Creating unique index on inquiryId and indexes on phoneNumber, programId...');
  const s = Date.now();
  await coll.createIndex({ inquiryId: 1 }, { unique: true, background: true });
  await coll.createIndex({ phoneNumber: 1 }, { background: true });
  await coll.createIndex({ programId: 1 }, { background: true });
  await coll.createIndex({ createdAt: -1 }, { background: true });
  console.log('Indexes ensured in', Date.now() - s, 'ms');

  const startQ = Date.now();
  const doc = await coll.findOne({ inquiryId: 'EK06-02' });
  console.log('Indexed findOne EK06-02 took:', Date.now() - startQ, 'ms', doc ? doc.husbandName : 'not found');

  await mongoose.disconnect();
}

indexSubmissions().catch(console.error);
