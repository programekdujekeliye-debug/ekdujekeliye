import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

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
