import dns from 'dns';
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { WhatsappConversation } from '../src/models/WhatsappConversation.js';

const prodUri = env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function testQuery(filter, eventId, search) {
  const query = {};
  if (eventId && eventId !== 'all') {
    query.eventId = eventId;
  }
  if (filter === 'unread') {
    query.unreadCount = { $gt: 0 };
  } else if (filter === 'open') {
    query.status = 'OPEN';
  }

  const [convs, total] = await Promise.all([
    WhatsappConversation.find(query)
      .sort({ unreadCount: -1, lastMessageAt: -1 })
      .limit(10)
      .lean(),
    WhatsappConversation.countDocuments(query)
  ]);

  console.log(`\n--- Filter: ${filter} | Event: ${eventId || 'NONE'} ---`);
  console.log(`Total matching: ${total}`);
  convs.forEach((c, idx) => {
    console.log(`${idx + 1}. Phone: ${c.phone} | Unread: ${c.unreadCount} | Name: ${c.customerName} | LastMsg: ${c.lastMessagePreview?.slice(0, 30)} | Event: ${c.eventId}`);
  });
}

async function run() {
  await mongoose.connect(prodUri);

  await testQuery('all', undefined);
  await testQuery('unread', undefined);
  await testQuery('all', 'prog-2026-09-07');
  await testQuery('unread', 'prog-2026-09-07');

  await mongoose.disconnect();
}

run().catch(console.error);
