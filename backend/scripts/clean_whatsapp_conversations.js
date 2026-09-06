import dns from 'dns';
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { WhatsappConversation } from '../src/models/WhatsappConversation.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';
import { normalizePhoneNumber, maskPhoneNumber, hashPhoneNumber } from '../src/integrations/whatsapp/whatsapp.service.js';

const prodUri = env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

function formatPhoneDisplay(phone) {
  if (!phone) return 'WhatsApp Guest';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone;
}

async function cleanAndRebuildConversations() {
  await mongoose.connect(prodUri);
  console.log('Connected to MongoDB. Analyzing conversations...');

  // 1. Fetch all inbound messages to identify every phone number that actually replied
  const allInboundMsgs = await WhatsappMessage.find({ direction: 'INBOUND' }).lean();
  console.log(`Found ${allInboundMsgs.length} inbound messages from customers.`);

  const inboundPhones = new Set();
  allInboundMsgs.forEach(m => {
    const p = normalizePhoneNumber(m.senderPhone);
    if (p) inboundPhones.add(p);
    const clean10 = (p || '').replace(/^91/, '');
    if (clean10) inboundPhones.add(clean10);
  });
  console.log(`Identified ${inboundPhones.size} unique customer phone numbers with inbound replies.`);

  // 2. Fetch all active/upcoming registrations for 2026 events
  const allRegs = await Registration.find({ isDeleted: { $ne: true } }).lean();
  const regMap = new Map();
  for (const reg of allRegs) {
    const p = normalizePhoneNumber(reg.phoneNumber);
    if (p) {
      regMap.set(p, reg);
      regMap.set(p.replace(/^91/, ''), reg);
    }
  }
  console.log(`Loaded ${allRegs.length} total registrations.`);

  // 3. Inspect existing conversations
  const allConvs = await WhatsappConversation.find().lean();
  console.log(`Current total WhatsappConversation documents: ${allConvs.length}`);

  const toDeleteIds = [];
  const toKeepConvs = [];

  for (const conv of allConvs) {
    const p = normalizePhoneNumber(conv.phone);
    const clean10 = (p || '').replace(/^91/, '');

    const hasInbound = inboundPhones.has(p) || inboundPhones.has(clean10) || conv.lastInboundAt != null;
    const hasNotes = conv.notes && conv.notes.length > 0;
    const isRegistered = conv.registrationId != null || regMap.has(p) || regMap.has(clean10);

    // Keep if customer replied, has staff notes, or has unread replies
    if (hasInbound || hasNotes || (conv.unreadCount && conv.unreadCount > 0)) {
      toKeepConvs.push(conv);
    } else if (isRegistered && (conv.unreadCount > 0 || conv.lastMessageDirection === 'INBOUND')) {
      toKeepConvs.push(conv);
    } else {
      // Broadcast-only or dead historical sync record
      toDeleteIds.push(conv._id);
    }
  }

  console.log(`\nConversations to KEEP (real customer chats/replies/notes): ${toKeepConvs.length}`);
  console.log(`Phantom broadcast conversations to DELETE: ${toDeleteIds.length}`);

  // 4. Delete phantom records
  if (toDeleteIds.length > 0) {
    const delRes = await WhatsappConversation.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`Deleted ${delRes.deletedCount} phantom conversation records.`);
  }

  // 5. Ensure every inbound phone number has a WhatsappConversation
  const existingPhones = new Set();
  const remainingConvs = await WhatsappConversation.find().lean();
  remainingConvs.forEach(c => {
    const p = normalizePhoneNumber(c.phone);
    if (p) existingPhones.add(p);
    const clean10 = (p || '').replace(/^91/, '');
    if (clean10) existingPhones.add(clean10);
  });

  let newlyCreated = 0;
  for (const senderPhone of inboundPhones) {
    if (!existingPhones.has(senderPhone) && senderPhone.length >= 10) {
      const norm = normalizePhoneNumber(senderPhone);
      const clean10 = norm.replace(/^91/, '');
      const reg = regMap.get(norm) || regMap.get(clean10) || null;
      const coupleName = reg
        ? `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim() || reg.coupleName
        : formatPhoneDisplay(norm);

      await WhatsappConversation.create({
        phone: norm,
        phoneMasked: maskPhoneNumber(norm),
        phoneHash: hashPhoneNumber(norm),
        registrationId: reg?._id || null,
        inquiryId: reg?.inquiryId || null,
        eventId: reg?.programId || null,
        customerName: coupleName,
        status: 'OPEN',
        unreadCount: 1,
        lastMessageAt: new Date(),
        lastMessagePreview: 'Customer reply',
        lastMessageDirection: 'INBOUND',
        lastMessageStatus: 'RECEIVED',
        lastInboundAt: new Date(),
        customerServiceWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      newlyCreated++;
    }
  }
  console.log(`Created ${newlyCreated} missing conversations for inbound senders.`);

  // 6. Recalculate and update all conversations to guarantee 100% data integrity
  const finalConvs = await WhatsappConversation.find();
  console.log(`\nRefreshing & updating ${finalConvs.length} active support conversations...`);

  for (const conv of finalConvs) {
    const p = normalizePhoneNumber(conv.phone);
    const clean10 = (p || '').replace(/^91/, '');
    const phoneVariants = [conv.phone, p, clean10, `91${clean10}`, `+91${clean10}`, `+${p}`].filter(Boolean);

    // Fetch all messages for this contact
    const messages = await WhatsappMessage.find({
      $or: [
        { conversationId: conv._id },
        { recipientPhone: { $in: phoneVariants } },
        { senderPhone: { $in: phoneVariants } }
      ]
    }).sort({ createdAt: 1 });

    // Link any orphaned messages
    for (const msg of messages) {
      if (!msg.conversationId || msg.conversationId.toString() !== conv._id.toString()) {
        msg.conversationId = conv._id;
        await msg.save();
      }
    }

    const reg = conv.registrationId
      ? (allRegs.find(r => r._id.toString() === conv.registrationId.toString()) || regMap.get(p) || regMap.get(clean10))
      : (regMap.get(p) || regMap.get(clean10) || null);

    const inboundList = messages.filter(m => m.direction === 'INBOUND');
    const outboundList = messages.filter(m => m.direction === 'OUTBOUND');
    const unreadCount = inboundList.filter(m => !m.readByAdminAt).length;

    const lastMsg = messages[messages.length - 1] || null;
    const lastInbound = inboundList[inboundList.length - 1] || null;
    const lastOutbound = outboundList[outboundList.length - 1] || null;

    // Customer Name Resolution
    let resolvedName = conv.customerName;
    if (reg) {
      resolvedName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim() || reg.coupleName || 'Respected Couple';
    } else if (!resolvedName || resolvedName === 'WhatsApp Guest' || resolvedName.startsWith('91') || resolvedName.includes('*')) {
      resolvedName = formatPhoneDisplay(p);
    }

    // 24-Hour Customer Service Window
    let windowExpiry = conv.customerServiceWindowExpiresAt;
    if (lastInbound && lastInbound.createdAt) {
      windowExpiry = new Date(new Date(lastInbound.createdAt).getTime() + 24 * 60 * 60 * 1000);
    }

    conv.customerName = resolvedName;
    conv.registrationId = reg?._id || conv.registrationId || null;
    conv.inquiryId = reg?.inquiryId || conv.inquiryId || null;
    conv.eventId = reg?.programId || conv.eventId || null;
    conv.unreadCount = unreadCount;
    conv.status = unreadCount > 0 ? 'OPEN' : conv.status || 'OPEN';

    if (lastMsg) {
      conv.lastMessageAt = lastMsg.createdAt;
      conv.lastMessagePreview = lastMsg.content || (lastMsg.templateName ? `[Template: ${lastMsg.templateName}]` : '[Message]');
      conv.lastMessageDirection = lastMsg.direction || 'INBOUND';
      conv.lastMessageStatus = lastMsg.status || 'RECEIVED';
    }
    if (lastInbound) {
      conv.lastInboundAt = lastInbound.createdAt;
    }
    if (lastOutbound) {
      conv.lastOutboundAt = lastOutbound.createdAt;
    }
    conv.customerServiceWindowExpiresAt = windowExpiry;

    await conv.save();
  }

  const finalTotal = await WhatsappConversation.countDocuments();
  const unreadTotal = await WhatsappConversation.countDocuments({ unreadCount: { $gt: 0 } });
  const openTotal = await WhatsappConversation.countDocuments({ status: 'OPEN' });

  console.log(`\n============================================================`);
  console.log(`DATABASE CLEANUP COMPLETE!`);
  console.log(`Total Active Support Conversations: ${finalTotal}`);
  console.log(`Awaiting Operator Reply (Unread > 0): ${unreadTotal}`);
  console.log(`Active Open Conversations: ${openTotal}`);
  console.log(`============================================================\n`);

  await mongoose.disconnect();
}

cleanAndRebuildConversations().catch(console.error);
