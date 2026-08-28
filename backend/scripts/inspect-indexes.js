import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function inspect() {
  await mongoose.connect(env.MONGO_URI);
  const coll = mongoose.connection.db.collection('program');
  const indexes = await coll.indexes();
  console.log('Indexes on program collection:', JSON.stringify(indexes, null, 2));

  const count = await coll.countDocuments();
  console.log('Total documents in program:', count);

  console.log('Ensuring indexes on slug, id, and status...');
  const start = Date.now();
  await coll.createIndex({ slug: 1 }, { background: true });
  await coll.createIndex({ id: 1 }, { background: true });
  await coll.createIndex({ status: 1, date: 1 }, { background: true });
  console.log('Indexes created/ensured in', Date.now() - start, 'ms');

  const startQuery = Date.now();
  const doc = await coll.findOne({ slug: 'surat-7-september-2026' });
  console.log('Indexed findOne took:', Date.now() - startQuery, 'ms', doc?.name);

  await mongoose.disconnect();
}

inspect().catch(console.error);
