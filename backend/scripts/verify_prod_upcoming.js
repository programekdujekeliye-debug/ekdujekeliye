import mongoose from 'mongoose';

async function checkProdUpcoming() {
  const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const upcoming = await db.collection('program').find({ status: 'upcoming' }).toArray();
  console.log(`\n=== Production Upcoming Events in 'program' (Count: ${upcoming.length}) ===`);
  upcoming.forEach(e => {
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
      isRegistrationOpen: e.isRegistrationOpen,
      isPaymentEnabled: e.isPaymentEnabled,
      earlyRegistrationMode: e.earlyRegistrationMode,
      communicationsEnabled: e.communicationsEnabled,
      paymentOpenedAt: e.paymentOpenedAt
    }, null, 2));
  });

  const waCount = await db.collection('whatsapp_messages').countDocuments({});
  console.log(`\nTotal WhatsApp messages in production DB: ${waCount}`);

  process.exit(0);
}

checkProdUpcoming().catch(console.error);
