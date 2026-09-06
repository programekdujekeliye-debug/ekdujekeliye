import mongoose from 'mongoose';
const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

await mongoose.connect(prodUri);
const db = mongoose.connection.db;

const stats48h = await db.collection('whatsapp_messages').aggregate([
  { $match: { eventId: 'prog-2026-09-07', trigger: 'scheduled_48h_pass_reminder' } },
  { $group: { _id: '$status', count: { $sum: 1 } } }
]).toArray();

console.log('48h Pass Reminder Status Breakdown in PROD:');
console.log(stats48h);

const total = await db.collection('whatsapp_messages').countDocuments({
  eventId: 'prog-2026-09-07',
  trigger: 'scheduled_48h_pass_reminder'
});
console.log('Total 48h messages in DB for 7 Sep:', total);

// Let's check status count for ALL 7 Sep messages
const allStats = await db.collection('whatsapp_messages').aggregate([
  { $match: { eventId: 'prog-2026-09-07' } },
  { $group: { _id: { trigger: '$trigger', status: '$status' }, count: { $sum: 1 } } }
]).toArray();
console.log('\nAll 7 Sep Message Breakdown:');
console.log(allStats);

// Check if any messages are currently LOCKED or PROCESSING
const locked = await db.collection('whatsapp_messages').countDocuments({
  eventId: 'prog-2026-09-07',
  lockedAt: { $ne: null }
});
console.log('\nLocked messages currently:', locked);

// Check 1 failed message for 48h
const failed = await db.collection('whatsapp_messages').find({
  eventId: 'prog-2026-09-07',
  trigger: 'scheduled_48h_pass_reminder',
  status: 'FAILED'
}).toArray();
console.log('\nFailed 48h message details:');
failed.forEach(f => {
  console.log({
    inquiryId: f.inquiryId,
    phone: f.recipientPhone,
    lastErrorMessage: f.lastErrorMessage,
    failedAt: f.failedAt
  });
});

await mongoose.disconnect();
