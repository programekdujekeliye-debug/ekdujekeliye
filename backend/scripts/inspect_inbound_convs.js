import dns from 'dns';
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const prodUri = env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  await mongoose.connect(prodUri);
  const db = mongoose.connection.db;

  const convs = await db.collection('whatsapp_conversations').find({
    lastInboundAt: { $ne: null }
  }).sort({ lastInboundAt: -1 }).limit(20).toArray();

  console.log(`Found ${convs.length} sample inbound conversations:`);
  for (const c of convs) {
    console.log({
      id: c._id,
      phone: c.phone,
      name: c.customerName,
      status: c.status,
      unread: c.unreadCount,
      lastMsg: c.lastMessagePreview?.slice(0, 50),
      lastInbound: c.lastInboundAt,
      eventId: c.eventId,
      regId: c.registrationId
    });
  }

  await mongoose.disconnect();
}
run().catch(console.error);
