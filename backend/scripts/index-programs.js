import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function indexPrograms() {
  await mongoose.connect(env.MONGO_URI);
  const coll = mongoose.connection.db.collection('program');
  const existingIndexes = await coll.indexes();
  console.log('Existing indexes on program:', JSON.stringify(existingIndexes, null, 2));

  console.log('Creating unique indexes on id and slug in program collection...');
  const s = Date.now();
  await coll.createIndex({ id: 1 }, { unique: true, background: true });
  await coll.createIndex({ slug: 1 }, { background: true });
  await coll.createIndex({ status: 1, date: 1 }, { background: true });
  console.log('Program indexes ensured in', Date.now() - s, 'ms');

  const startQ = Date.now();
  const doc = await coll.findOne({ id: 'prog_68ad08ec3964' });
  console.log('Indexed findOne program took:', Date.now() - startQ, 'ms', doc ? doc.name : 'not found');

  const startQ2 = Date.now();
  const doc2 = await coll.findOne({ slug: 'surat-7-september-2026' });
  console.log('Indexed findOne slug took:', Date.now() - startQ2, 'ms', doc2 ? doc2.name : 'not found');

  await mongoose.disconnect();
}

indexPrograms().catch(console.error);
