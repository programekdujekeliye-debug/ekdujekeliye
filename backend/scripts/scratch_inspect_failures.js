import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const msgs = await db.collection('whatsapp_messages').find({
    messageId: { $in: ['WA-REM10-316d14abe45cff49', 'WA-MSG-846fb9531d36b0fa', 'WA-MSG-30e2f572bb368d36', 'WA-REM10-03bb3d3f24804cb5'] }
  }).toArray();

  console.log('--- DETAILED FAILED MESSAGES ---');
  msgs.forEach(m => {
    console.log(JSON.stringify(m, null, 2));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
