import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  const sub = await db.collection('submission').findOne({ inquiryId: 'EK08-01' });
  console.log('EK08-01 details:');
  console.log({
    inquiryId: sub?.inquiryId,
    couplePhoto: sub?.couplePhoto,
    photoZoom: sub?.photoZoom,
    photoOffsetX: sub?.photoOffsetX,
    photoOffsetY: sub?.photoOffsetY,
    frameExportStatus: sub?.frameExportStatus,
    status: sub?.status,
    payment: sub?.payment
  });

  const samples = await db.collection('submission')
    .find({ couplePhoto: { $exists: true, $ne: '' } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  console.log('\n--- 5 RECENT SUBMISSIONS WITH PHOTOS ---');
  samples.forEach(s => {
    console.log({
      inquiryId: s.inquiryId,
      couplePhoto: s.couplePhoto,
      status: s.status,
      paymentStatus: s.payment?.status,
      programId: s.programId
    });
  });

  await mongoose.disconnect();
}

run().catch(console.error);
