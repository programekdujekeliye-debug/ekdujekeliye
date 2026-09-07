import mongoose from 'mongoose';

const PROD_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(PROD_URI);
  const ev = await mongoose.connection.db.collection('program').findOne({
    $or: [{ id: 'prog-2026-09-07' }, { date: '2026-09-07' }]
  });
  console.log('Event prog-2026-09-07:');
  console.log(JSON.stringify({
    id: ev.id,
    name: ev.name,
    date: ev.date,
    time: ev.time,
    status: ev.status,
    capacity: ev.capacity,
    bookedSeats: ev.bookedSeats,
    isRegistrationOpen: ev.isRegistrationOpen,
    isPaymentEnabled: ev.isPaymentEnabled,
    earlyRegistrationMode: ev.earlyRegistrationMode,
    isDateFinal: ev.isDateFinal,
    archived: ev.archived
  }, null, 2));

  // Also check all programs
  const allProgs = await mongoose.connection.db.collection('program').find({}).toArray();
  console.log('\nAll Programs in DB:');
  allProgs.forEach(p => {
    console.log(`${p.id} (${p.name}) | date: ${p.date} | status: ${p.status} | cap: ${p.capacity} | booked: ${p.bookedSeats} | open: ${p.isRegistrationOpen}`);
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
