import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const payConfs = await db.collection('whatsapp_messages').aggregate([
    { $match: { trigger: { $in: ['payment_verified', 'payment_webhook_captured'] } } },
    { $group: { _id: { status: "$status", template: "$templateName", err: "$providerErrorMessage", code: "$providerErrorCode" }, count: { $sum: 1 } } }
  ]).toArray();

  console.log('--- PAYMENT CONFIRMATIONS STATS IN PROD ---');
  console.log(payConfs);

  // Check payment reminders stats
  const payReminders = await db.collection('whatsapp_messages').aggregate([
    { $match: { trigger: { $in: ['payment_reminder_10m', 'payment_reminder_24h'] } } },
    { $group: { _id: { status: "$status", template: "$templateName", err: "$providerErrorMessage", code: "$providerErrorCode" }, count: { $sum: 1 } } }
  ]).toArray();

  console.log('\n--- PAYMENT REMINDERS STATS IN PROD ---');
  console.log(payReminders);

  // Check all message statuses in last 7 days
  const recentStats = await db.collection('whatsapp_messages').aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: { status: "$status", trigger: "$trigger" }, count: { $sum: 1 } } }
  ]).toArray();

  console.log('\n--- RECENT 7-DAY STATS ---');
  console.log(recentStats);

  await mongoose.disconnect();
}

run().catch(console.error);
