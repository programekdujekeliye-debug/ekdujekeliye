import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const prodUri = env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  await mongoose.connect(prodUri);
  const db = mongoose.connection.db;

  const totalConvs = await db.collection('whatsapp_conversations').countDocuments();
  const inboundConvs = await db.collection('whatsapp_conversations').find({ lastInboundAt: { $ne: null } }).toArray();
  const totalInboundMsgs = await db.collection('whatsapp_messages').countDocuments({ direction: 'INBOUND' });
  const sampleInboundMsgs = await db.collection('whatsapp_messages').find({ direction: 'INBOUND' }).sort({ createdAt: -1 }).limit(15).toArray();

  console.log('Total Convs:', totalConvs);
  console.log('Convs with lastInboundAt:', inboundConvs.length);
  console.log('Total INBOUND msgs:', totalInboundMsgs);
  console.log('Recent 15 INBOUND msgs:');
  sampleInboundMsgs.forEach(m => {
    console.log({
      sender: m.senderPhone,
      content: m.content,
      createdAt: m.createdAt,
      convId: m.conversationId
    });
  });

  const uniqueInboundSenders = await db.collection('whatsapp_messages').distinct('senderPhone', { direction: 'INBOUND' });
  console.log('Unique inbound senders count:', uniqueInboundSenders.length, uniqueInboundSenders);

  await mongoose.disconnect();
}
run().catch(console.error);
