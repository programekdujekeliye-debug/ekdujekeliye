import mongoose from 'mongoose';

const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const sampleSubs = await db.collection('submission').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('--- RECENT SUBMISSIONS (PROD) ---');
  sampleSubs.forEach(s => {
    console.log({
      inquiryId: s.inquiryId,
      name: `${s.husbandName} & ${s.wifeName}`,
      programId: s.programId,
      programName: s.programName,
      programDate: s.programDate,
      status: s.status,
      createdAt: s.createdAt
    });
  });

  // Count submissions per programId
  const counts = await db.collection('submission').aggregate([
    { $group: { _id: { programId: "$programId", programDate: "$programDate" }, count: { $sum: 1 } } }
  ]).toArray();
  console.log('\n--- SUBMISSION COUNTS BY PROGRAM ---');
  console.log(counts);

  await mongoose.disconnect();
}

run().catch(console.error);
