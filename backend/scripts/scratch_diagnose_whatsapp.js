import mongoose from 'mongoose';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  await mongoose.connect(prodUri);
  const db = mongoose.connection.db;

  const totalConvs = await db.collection('whatsapp_conversations').countDocuments();
  console.log('Total WhatsappConversation records:', totalConvs);

  // Inbound messages
  const inboundMsgs = await db.collection('whatsapp_messages').find({ direction: 'INBOUND' }).toArray();
  console.log('\nTotal INBOUND messages in whatsapp_messages:', inboundMsgs.length);
  
  const senderSet = new Set();
  inboundMsgs.forEach(m => {
    senderSet.add(m.senderPhone || m.recipientPhone);
  });
  console.log('Unique sender phone numbers who sent INBOUND messages:', senderSet.size);
  console.log('Sender numbers:', Array.from(senderSet));

  // Inbound messages details
  console.log('\nRecent 10 Inbound Messages:');
  inboundMsgs.slice(-10).forEach(m => {
    console.log({
      id: m._id,
      from: m.senderPhone,
      to: m.recipientPhone,
      text: m.content,
      createdAt: m.createdAt,
      conversationId: m.conversationId
    });
  });

  // Check how many conversations have lastInboundAt
  const convsWithInbound = await db.collection('whatsapp_conversations').find({
    lastInboundAt: { $ne: null }
  }).toArray();
  console.log('\nConversations with lastInboundAt != null:', convsWithInbound.length);
  convsWithInbound.forEach(c => {
    console.log({
      id: c._id,
      phone: c.phone,
      customerName: c.customerName,
      unreadCount: c.unreadCount,
      lastMessagePreview: c.lastMessagePreview,
      lastInboundAt: c.lastInboundAt
    });
  });

  // Check how many conversations are purely from marketing_broadcast with NO inbound reply
  const broadcastOnlyConvs = await db.collection('whatsapp_conversations').countDocuments({
    lastInboundAt: null,
    registrationId: null,
    inquiryId: null
  });
  console.log('\nBroadcast-only conversations with NO inbound reply and NO registration:', broadcastOnlyConvs);

  await mongoose.disconnect();
}

run().catch(console.error);
