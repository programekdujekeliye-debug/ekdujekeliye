import dns from 'dns';
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { WhatsappConversation } from '../src/models/WhatsappConversation.js';

const prodUri = env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  await mongoose.connect(prodUri);
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const baseFilter = {
    $or: [
      { lastInboundAt: { $ne: null } },
      { unreadCount: { $gt: 0 } },
      { 'notes.0': { $exists: true } },
      { registrationId: { $ne: null } }
    ]
  };

  const [openCount, unreadCount, unassignedCount, windowExpiringSoonCount, totalConversations] = await Promise.all([
    WhatsappConversation.countDocuments({ ...baseFilter, status: 'OPEN' }),
    WhatsappConversation.countDocuments({ ...baseFilter, unreadCount: { $gt: 0 } }),
    WhatsappConversation.countDocuments({ ...baseFilter, status: 'OPEN', assignedAdminId: null }),
    WhatsappConversation.countDocuments({
      ...baseFilter,
      status: 'OPEN',
      customerServiceWindowExpiresAt: { $gt: now, $lte: twoHoursLater }
    }),
    WhatsappConversation.countDocuments(baseFilter)
  ]);

  console.log('STATS OVERVIEW:');
  console.log({
    totalConversations,
    openCount,
    unreadCount,
    unassignedCount,
    windowExpiringSoonCount
  });

  await mongoose.disconnect();
}
run().catch(console.error);
