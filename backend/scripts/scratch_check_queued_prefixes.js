import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  // Let's check queued messages across all triggers
  const allQueued = await db.collection('whatsapp_messages').aggregate([
    { $match: { status: 'QUEUED' } },
    {
      $project: {
        eventId: 1,
        trigger: 1,
        inquiryId: 1,
        prefix: { $arrayElemAt: [{ $split: ["$inquiryId", "-"] }, 0] }
      }
    },
    {
      $group: {
        _id: { eventId: "$eventId", trigger: "$trigger", prefix: "$prefix" },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.eventId": 1, count: -1 } }
  ]).toArray();

  console.log('--- ALL QUEUED BREAKDOWN BY PREFIX ---');
  console.log(allQueued);

  await mongoose.disconnect();
}

run().catch(console.error);
