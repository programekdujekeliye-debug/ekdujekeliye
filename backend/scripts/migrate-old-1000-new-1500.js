import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function migrateAllOldEventsAndRegistrationsTo1000() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  const programColl = mongoose.connection.db.collection('program');
  const submissionColl = mongoose.connection.db.collection('submission');

  const allPrograms = await programColl.find({}).toArray();
  console.log(`\nFound ${allPrograms.length} programs in database:`);

  const oldProgramIds = [];
  const upcomingProgramIds = [];

  for (const prog of allPrograms) {
    const dateStr = String(prog.date || '');
    const isUpcoming = dateStr.startsWith('2026-09') || dateStr === 'TBD' || dateStr === 'TBA' || (prog.status === 'upcoming' && !dateStr.startsWith('2026-08'));

    if (isUpcoming) {
      upcomingProgramIds.push(prog.id);
      await programColl.updateOne({ _id: prog._id }, { $set: { price: 1500 } });
      console.log(`  [UPCOMING -> ₹1500] ${prog.id} | ${prog.name} (${prog.date})`);
    } else {
      oldProgramIds.push(prog.id);
      await programColl.updateOne({ _id: prog._id }, { $set: { price: 1000 } });
      console.log(`  [OLD / PAST -> ₹1000] ${prog.id} | ${prog.name} (${prog.date})`);
    }
  }

  console.log('\n--- Updating Submissions for Old Events (setting payment.amount = 1000) ---');
  // Update all submissions belonging to old programs or having programDate in August
  const oldSubsRes = await submissionColl.updateMany(
    {
      $or: [
        { programId: { $in: oldProgramIds } },
        { programDate: { $regex: /^2026-08/ } },
        { inquiryId: { $regex: /^(EK0[1-5]|IP-)/ } }
      ]
    },
    {
      $set: {
        'payment.amount': 1000,
        'payment.provider': 'legacy_upi',
        'payment.status': 'captured',
        'payment.currency': 'INR',
        amount: 1000
      }
    }
  );
  console.log(`Updated ${oldSubsRes.modifiedCount} registrations for OLD events to ₹1000.`);

  console.log('\n--- Updating Submissions for Upcoming Events (setting payment.amount = 1500) ---');
  const upcomingSubsRes = await submissionColl.updateMany(
    {
      $or: [
        { programId: { $in: upcomingProgramIds } },
        { programDate: { $regex: /^2026-09/ } },
        { inquiryId: { $regex: /^EK06-/ } }
      ]
    },
    {
      $set: {
        'payment.amount': 1500,
        amount: 1500
      }
    }
  );
  console.log(`Updated ${upcomingSubsRes.modifiedCount} registrations for UPCOMING events to ₹1500.`);

  console.log('\n--- Verification: Inspecting Sample Documents ---');
  const oldSample = await submissionColl.findOne({ inquiryId: 'EK05-721' });
  console.log(`EK05-721 (Old Event): payment.amount = ₹${oldSample?.payment?.amount}, status = ${oldSample?.status}`);

  const oldSample2 = await submissionColl.findOne({ inquiryId: 'IP-217' });
  console.log(`IP-217 (Old Event): payment.amount = ₹${oldSample2?.payment?.amount}, status = ${oldSample2?.status}`);

  const upcomingSample = await submissionColl.findOne({ inquiryId: 'EK06-02' });
  console.log(`EK06-02 (Upcoming Event): payment.amount = ₹${upcomingSample?.payment?.amount}, status = ${upcomingSample?.status}`);

  await mongoose.disconnect();
}

migrateAllOldEventsAndRegistrationsTo1000().catch(console.error);
