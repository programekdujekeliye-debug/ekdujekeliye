import mongoose from 'mongoose';

async function checkEvents() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const events = await db.collection('events').find({}).sort({ date: 1, sequenceNumber: 1 }).toArray();

  console.log('=== PRODUCTION EVENTS IN DB ===');
  events.forEach(e => {
    console.log(JSON.stringify({
      id: e.id || e._id,
      sequenceNumber: e.sequenceNumber,
      name: e.name,
      slug: e.slug,
      date: e.date,
      time: e.time,
      venue: e.venue,
      city: e.city,
      price: e.price,
      capacity: e.capacity,
      status: e.status,
      isDateFinal: e.isDateFinal,
      isInquiryClosed: e.isInquiryClosed,
      isPaymentEnabled: e.isPaymentEnabled,
      communicationsEnabled: e.communicationsEnabled,
      earlyRegistrationMode: e.earlyRegistrationMode,
      paymentOpenedAt: e.paymentOpenedAt
    }, null, 2));
  });

  const submissions = await db.collection('submission').aggregate([
    { $group: { _id: "$programDate", count: { $sum: 1 }, sampleIds: { $push: "$inquiryId" } } }
  ]).toArray();

  console.log('\n=== SUBMISSIONS BY PROGRAM DATE IN PROD ===');
  console.log(JSON.stringify(submissions, null, 2));

  process.exit(0);
}

checkEvents().catch(console.error);
