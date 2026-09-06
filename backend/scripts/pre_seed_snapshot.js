import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { env } from '../src/config/env.js';

async function takeSnapshot() {
  const uri = process.env.PROD_MONGO_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('--- STARTING PRE-SEEDING SNAPSHOT ---');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const snapshotFile = path.join(backupDir, `pre_seed_snapshot_${timestamp}.json`);

  // 1. Capture all existing programs
  const programs = await db.collection('program').find({}).toArray();
  console.log(`Captured ${programs.length} existing programs.`);

  // 2. Capture all counters
  const counters = await db.collection('counter').find({}).toArray();
  console.log(`Captured ${counters.length} existing counters.`);

  // 3. Capture submission summary & total count
  const subCount = await db.collection('submission').countDocuments({});
  const subSummary = await db.collection('submission').aggregate([
    { $group: { _id: { programId: '$programId', programDate: '$programDate' }, count: { $sum: 1 } } },
    { $sort: { '_id.programDate': 1 } }
  ]).toArray();

  console.log(`Total existing submissions: ${subCount}`);

  const snapshotData = {
    timestamp: new Date().toISOString(),
    totalSubmissions: subCount,
    submissionSummary: subSummary,
    programs,
    counters
  };

  fs.writeFileSync(snapshotFile, JSON.stringify(snapshotData, null, 2), 'utf-8');
  console.log(`✅ Pre-seeding snapshot written successfully to: ${snapshotFile}`);

  await mongoose.disconnect();
}

takeSnapshot().catch(err => {
  console.error('❌ Snapshot failed:', err);
  process.exit(1);
});
