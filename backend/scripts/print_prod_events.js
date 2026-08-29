import mongoose from 'mongoose';

async function checkEvents() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const events = await db.collection('events').find({}).sort({ date: 1 }).toArray();

  console.log('=== ALL EVENTS IN PRODUCTION ===');
  events.forEach((e, i) => {
    console.log(`${i + 1}. [${e.id || e._id}] Seq: ${e.sequenceNumber} | Name: "${e.name}" | Slug: "${e.slug}" | Date: ${e.date} | Time: ${e.time} | City: ${e.city} | Venue: "${e.venue}" | Price: ${e.price} | Capacity: ${e.capacity} | Status: ${e.status} | isDateFinal: ${e.isDateFinal} | isPaymentEnabled: ${e.isPaymentEnabled} | communicationsEnabled: ${e.communicationsEnabled}`);
  });

  process.exit(0);
}

checkEvents().catch(console.error);
