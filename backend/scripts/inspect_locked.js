import mongoose from 'mongoose';
const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

await mongoose.connect(prodUri);
const db = mongoose.connection.db;

const lockedMsgs = await db.collection('whatsapp_messages').aggregate([
  { $match: { lockedAt: { $ne: null } } },
  { $group: { _id: { trigger: '$trigger', status: '$status' }, count: { $sum: 1 }, oldestLock: { $min: '$lockedAt' }, newestLock: { $max: '$lockedAt' } } }
]).toArray();

console.log('Locked messages breakdown:');
console.log(lockedMsgs);

await mongoose.disconnect();
