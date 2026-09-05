import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const sampleQueued = await db.collection('whatsapp_messages').find({
    eventId: 'prog-2026-09-07',
    trigger: 'post_event_memories_feedback',
    status: 'QUEUED'
  }).limit(10).toArray();

  console.log('--- SAMPLE QUEUED POST-EVENT FOR 09-07 ---');
  sampleQueued.forEach(m => {
    console.log({
      id: m.messageId,
      inquiryId: m.inquiryId,
      registrationId: m.registrationId,
      phone: m.recipientPhone,
      customerName: m.templateParameters?.customerName,
      scheduledFor: m.scheduledFor,
      createdAt: m.createdAt,
      idempotencyKey: m.idempotencyKey
    });
  });

  // Check where those inquiryIds come from
  const inquiryIds = sampleQueued.map(m => m.inquiryId);
  const subs = await db.collection('submission').find({ inquiryId: { $in: inquiryIds } }).toArray();
  console.log('\n--- MATCHING SUBMISSIONS ---');
  subs.forEach(s => {
    console.log({
      inquiryId: s.inquiryId,
      name: `${s.husbandName} & ${s.wifeName}`,
      programId: s.programId,
      programDate: s.programDate,
      status: s.status
    });
  });

  await mongoose.disconnect();
}

run().catch(console.error);
