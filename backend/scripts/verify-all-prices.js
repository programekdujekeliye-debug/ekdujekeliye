import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function verifyAll() {
  await mongoose.connect(env.MONGO_URI);
  const coll = mongoose.connection.db.collection('submission');
  const programColl = mongoose.connection.db.collection('program');

  console.log('--- Checking Programs in Database ---');
  const programs = await programColl.find({}).toArray();
  programs.forEach(p => {
    console.log(`[${p.id}] ${p.name} (${p.date}) => price: ₹${p.price}`);
  });

  console.log('\n--- Checking Sample Old Registrations ---');
  const oldSample = await coll.find({ programDate: { $regex: /^2026-08/ } }).limit(5).toArray();
  oldSample.forEach(s => {
    console.log(`[${s.inquiryId}] ${s.husbandName} & ${s.wifeName} (${s.programDate}) -> payment: ₹${s.payment?.amount}, status: ${s.status}`);
  });

  console.log('\n--- Checking Sample Upcoming Registrations ---');
  const upcomingSample = await coll.find({ programDate: { $regex: /^2026-09/ } }).limit(5).toArray();
  upcomingSample.forEach(s => {
    console.log(`[${s.inquiryId}] ${s.husbandName} & ${s.wifeName} (${s.programDate}) -> payment: ₹${s.payment?.amount}, status: ${s.status}`);
  });

  await mongoose.disconnect();
}

verifyAll().catch(console.error);
