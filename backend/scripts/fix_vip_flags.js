import mongoose from 'mongoose';

async function checkAndFixVip() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const ipList = await db.collection('submission').find({
    $or: [
      { inquiryId: { $regex: '^IP-', $options: 'i' } },
      { isVip: true },
      { 'payment.provider': 'manual_invite' }
    ]
  }).toArray();

  console.log(`Found ${ipList.length} VIP/Manual Invite submissions:`);
  for (const item of ipList) {
    console.log(`- ${item.inquiryId}: ${item.husbandName} & ${item.wifeName} | isVip=${item.isVip} | provider=${item.payment?.provider}`);
  }

  // Ensure all IP-* records have isVip: true
  const updateRes = await db.collection('submission').updateMany(
    {
      $or: [
        { inquiryId: { $regex: '^IP-', $options: 'i' } },
        { 'payment.provider': 'manual_invite' }
      ]
    },
    { $set: { isVip: true } }
  );
  console.log(`Updated ${updateRes.modifiedCount} records with isVip: true`);

  process.exit(0);
}

checkAndFixVip().catch(e => {
  console.error(e);
  process.exit(1);
});
