import mongoose from 'mongoose';

const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const distinctInquiries = await db.collection('whatsapp_messages').distinct('inquiryId', {
    eventId: 'prog-2026-09-07',
    trigger: 'post_event_memories_feedback',
    status: 'QUEUED'
  });
  console.log('Total distinct inquiryIds for queued post-event in 09-07:', distinctInquiries.length);

  // Group by inquiryId to see if duplicates exist
  const duplicates = await db.collection('whatsapp_messages').aggregate([
    { $match: { eventId: 'prog-2026-09-07', trigger: 'post_event_memories_feedback', status: 'QUEUED' } },
    { $group: { _id: "$inquiryId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();

  console.log('Top duplicates in queued post-event:', duplicates);

  await mongoose.disconnect();
}

run().catch(console.error);
