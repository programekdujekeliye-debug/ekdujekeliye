import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const sub = await db.collection('submission').findOne({ inquiryId: /379/i });
  console.log('--- SUBMISSION 379 ---');
  console.log(JSON.stringify(sub, null, 2));

  if (sub) {
    const msgs = await db.collection('whatsapp_messages').find({
      $or: [
        { inquiryId: sub.inquiryId },
        { registrationId: sub._id },
        { recipientPhone: sub.phoneNumber }
      ]
    }).toArray();
    console.log(`--- MSGS FOR 379 (${msgs.length}) ---`);
    console.log(JSON.stringify(msgs, null, 2));
  }

  // Look at recent failed messages across ekdujekeliye
  const failedMsgs = await db.collection('whatsapp_messages').find({ status: 'FAILED' })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  console.log(`--- RECENT FAILED MSGS (${failedMsgs.length}) ---`);
  failedMsgs.forEach(m => {
    console.log({
      id: m.messageId,
      inquiryId: m.inquiryId,
      phone: m.recipientPhone,
      template: m.templateName,
      status: m.status,
      trigger: m.trigger,
      err: m.lastErrorMessage,
      code: m.lastErrorCode,
      createdAt: m.createdAt
    });
  });

  // Also look at programs in ekdujekeliye
  const progs = await db.collection('program').find({}).toArray();
  console.log('\n--- PROGRAMS IN PROD ---');
  progs.forEach(p => {
    console.log({
      id: p.id,
      slug: p.slug,
      name: p.name,
      date: p.date,
      time: p.time,
      venue: p.venue,
      city: p.city,
      status: p.status,
      price: p.price,
      isPaymentEnabled: p.isPaymentEnabled,
      earlyRegistrationMode: p.earlyRegistrationMode,
      communicationsEnabled: p.communicationsEnabled
    });
  });

  await mongoose.disconnect();
}

run().catch(console.error);
