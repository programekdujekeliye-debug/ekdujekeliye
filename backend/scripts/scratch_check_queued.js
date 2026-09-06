import mongoose from 'mongoose';

const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const queuedEvents = await db.collection('whatsapp_messages').aggregate([
    { $match: { status: 'QUEUED' } },
    { $group: { _id: { eventId: "$eventId", trigger: "$trigger" }, count: { $sum: 1 }, minDate: { $min: "$scheduledFor" }, maxDate: { $max: "$scheduledFor" } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log('--- QUEUED MESSAGES BY EVENT & TRIGGER ---');
  console.log(queuedEvents);

  await mongoose.disconnect();
}

run().catch(console.error);
