import mongoose from 'mongoose';

const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

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
