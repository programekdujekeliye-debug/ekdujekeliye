import mongoose from 'mongoose';

async function checkEvents() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const events = await mongoose.connection.db.collection('program').find({}).toArray();
  console.log('All events:');
  for (const e of events) {
    console.log(`- _id: ${e._id}, id: ${e.id}, seq: ${e.sequenceNumber}, date: ${e.date}, slug: ${e.slug}`);
  }
  process.exit(0);
}

checkEvents().catch(e => {
  console.error(e);
  process.exit(1);
});
