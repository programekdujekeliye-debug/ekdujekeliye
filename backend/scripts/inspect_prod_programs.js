import mongoose from 'mongoose';

async function checkEvents() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  
  // Check 'programs'
  const programs = await db.collection('programs').find({}).toArray();
  console.log(`\n=== 'programs' collection (Count: ${programs.length}) ===`);
  programs.forEach(e => {
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
      isPaymentEnabled: e.isPaymentEnabled,
      earlyRegistrationMode: e.earlyRegistrationMode,
      communicationsEnabled: e.communicationsEnabled
    }, null, 2));
  });

  // Check 'program'
  const program = await db.collection('program').find({}).toArray();
  console.log(`\n=== 'program' collection (Count: ${program.length}) ===`);
  program.forEach(e => {
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
      isPaymentEnabled: e.isPaymentEnabled,
      earlyRegistrationMode: e.earlyRegistrationMode,
      communicationsEnabled: e.communicationsEnabled
    }, null, 2));
  });

  process.exit(0);
}

checkEvents().catch(console.error);
