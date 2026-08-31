import mongoose from 'mongoose';

async function checkEventsAndStats() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  const events = await db.collection('program').find({}).toArray();
  console.log('=== EVENTS IN DB ===');
  for (const e of events) {
    console.log(`- ID: ${e.id} | Slug: ${e.slug} | Date: ${e.date} | Capacity: ${e.capacity} | Status: ${e.status}`);
  }

  const regGroup = await db.collection('submission').aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: { programId: '$programId', programDate: '$programDate', status: '$status' }, count: { $sum: 1 } } }
  ]).toArray();

  console.log('\n=== REGISTRATIONS BREAKDOWN ===');
  for (const r of regGroup) {
    console.log(`- programId: "${r._id.programId}", date: "${r._id.programDate}", status: "${r._id.status}" -> Count: ${r.count}`);
  }

  process.exit(0);
}

checkEventsAndStats().catch(e => {
  console.error(e);
  process.exit(1);
});
