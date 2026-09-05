import dns from 'dns';
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const prodUri = env.MONGODB_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(prodUri);
  const db = mongoose.connection.db;

  const total = await db.collection('whatsapp_conversations').countDocuments();
  const withInbound = await db.collection('whatsapp_conversations').countDocuments({ lastInboundAt: { $ne: null } });
  const withRegistration = await db.collection('whatsapp_conversations').countDocuments({ registrationId: { $ne: null } });
  const withInboundOrReg = await db.collection('whatsapp_conversations').countDocuments({
    $or: [
      { lastInboundAt: { $ne: null } },
      { registrationId: { $ne: null } }
    ]
  });
  const broadcastOnlyJunk = await db.collection('whatsapp_conversations').countDocuments({
    lastInboundAt: null,
    registrationId: null,
    inquiryId: null,
    $or: [
      { notes: { $exists: false } },
      { notes: { $size: 0 } }
    ]
  });

  console.log({
    total,
    withInbound,
    withRegistration,
    withInboundOrReg,
    broadcastOnlyJunk
  });

  await mongoose.disconnect();
}
run().catch(console.error);
