import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function setEventPrices() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  const programColl = mongoose.connection.db.collection('program');
  const submissionColl = mongoose.connection.db.collection('submission');

  const allPrograms = await programColl.find({}).toArray();
  console.log(`\nFound ${allPrograms.length} total events in database:\n`);

  const oldProgramIds = [];
  const upcomingProgramIds = [];

  for (const prog of allPrograms) {
    const dateStr = String(prog.date || '');
    // Check if event is in the past (e.g. August 2026 or before September 2026)
    // Upcoming events are September 2026 onwards (2026-09-07, 2026-09-11, TBD, etc.)
    const isUpcoming = dateStr.startsWith('2026-09') || dateStr === 'TBD' || dateStr === 'TBA' || prog.status === 'upcoming' && !dateStr.startsWith('2026-08');
    const targetPrice = isUpcoming ? 1500 : 1000;

    await programColl.updateOne(
      { _id: prog._id },
      { $set: { price: targetPrice } }
    );

    if (isUpcoming) {
      upcomingProgramIds.push(prog.id);
      console.log(`🚀 UPCOMING EVENT -> Set ₹1500: [${prog.id}] ${prog.name} (${prog.date})`);
    } else {
      oldProgramIds.push(prog.id);
      console.log(`📜 OLD / PAST EVENT -> Set ₹1000: [${prog.id}] ${prog.name} (${prog.date})`);
    }
  }

  // Update submissions/registrations for old programs to 1000
  if (oldProgramIds.length > 0) {
    const oldSubRes = await submissionColl.updateMany(
      { programId: { $in: oldProgramIds } },
      { $set: { 'payment.amount': 1000, amount: 1000 } }
    );
    console.log(`\nUpdated ${oldSubRes.modifiedCount} registration(s) linked to old events to ₹1000.`);
  }

  // Update submissions/registrations for upcoming programs to 1500
  if (upcomingProgramIds.length > 0) {
    const upcomingSubRes = await submissionColl.updateMany(
      { programId: { $in: upcomingProgramIds } },
      { $set: { 'payment.amount': 1500, amount: 1500 } }
    );
    console.log(`Updated ${upcomingSubRes.modifiedCount} registration(s) linked to upcoming events to ₹1500.`);
  }

  console.log('\n--- Final Verification of All Database Programs ---');
  const verifiedPrograms = await programColl.find({}).toArray();
  verifiedPrograms.forEach(p => {
    console.log(` - [${p.id}] ${p.name} (Date: ${p.date}) => ₹${p.price}`);
  });

  console.log('\n✅ Script completed successfully!');
  await mongoose.disconnect();
}

setEventPrices().catch(console.error);
