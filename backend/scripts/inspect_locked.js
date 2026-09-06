import mongoose from 'mongoose';
const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

await mongoose.connect(prodUri);
const db = mongoose.connection.db;

const lockedMsgs = await db.collection('whatsapp_messages').aggregate([
  { $match: { lockedAt: { $ne: null } } },
  { $group: { _id: { trigger: '$trigger', status: '$status' }, count: { $sum: 1 }, oldestLock: { $min: '$lockedAt' }, newestLock: { $max: '$lockedAt' } } }
]).toArray();

console.log('Locked messages breakdown:');
console.log(lockedMsgs);

await mongoose.disconnect();
