import mongoose from 'mongoose';

async function check() {
  const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const submissions = await db.collection('submission').find({}).toArray();

  console.log(`Total submissions in production: ${submissions.length}`);
  submissions.forEach(s => {
    console.log(`- _id: ${s._id} | inquiryId: ${s.inquiryId} | ${s.husbandName} & ${s.wifeName} ${s.surname} | Phone: ${s.phoneNumber} | programId: ${s.programId} | programDate: ${s.programDate} | status: ${s.status} | isDeleted: ${s.isDeleted}`);
  });

  const counters = await db.collection('counter').find({}).toArray();
  console.log('\nCounters in production:');
  counters.forEach(c => console.log(JSON.stringify(c)));

  process.exit(0);
}

check().catch(console.error);
