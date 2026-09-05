import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const msgs = await db.collection('whatsapp_messages').find({
    eventId: 'prog-2026-09-07',
    trigger: 'post_event_memories_feedback',
    status: 'QUEUED'
  }).project({ inquiryId: 1 }).toArray();

  const prefixes = {};
  msgs.forEach(m => {
    const p = (m.inquiryId || 'UNKNOWN').split('-')[0];
    prefixes[p] = (prefixes[p] || 0) + 1;
  });

  console.log('Inquiry ID prefixes in queued post-event messages:');
  console.log(prefixes);

  await mongoose.disconnect();
}

run().catch(console.error);
