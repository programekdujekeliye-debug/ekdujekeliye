import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const passes = await conn.connection.db.collection('passes').find({
    inquiryId: { $in: ['IP-01', 'IP-02', 'IP-03', 'IP-04'] }
  }).toArray();
  console.log('Passes for IP-01..04:', passes.map(p => ({ passId: p.passId, inquiryId: p.inquiryId })));

  const msgs = await conn.connection.db.collection('whatsapp_messages').find({
    inquiryId: { $in: ['IP-01', 'IP-02', 'IP-03', 'IP-04'] }
  }).toArray();
  console.log('Messages for IP-01..04:', msgs.map(m => ({ messageId: m.messageId, inquiryId: m.inquiryId, status: m.status })));

  await mongoose.disconnect();
}

run().catch(console.error);
