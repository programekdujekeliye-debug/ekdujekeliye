import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority');
  const Sub = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));
  
  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];

  // All paid submissions for event
  const paid = await Sub.find({
    programId: { $in: eventIds },
    $or: [{ status: 'approved' }, { 'payment.status': 'captured' }]
  }).sort({ createdAt: -1 }).lean();

  const unprinted = paid.filter(s => !s.frameExportStatus || s.frameExportStatus === 'NOT_EXPORTED');
  console.log(`Unprinted count: ${unprinted.length}`);

  console.log('\n--- All Unprinted Paid Submissions: ---');
  unprinted.forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.inquiryId} | ${s.husbandName} & ${s.wifeName} | CreatedAt: ${s.createdAt ? new Date(s.createdAt).toISOString() : 'none'} | HasPhoto: ${Boolean(s.couplePhoto)}`);
  });

  // Check the latest paid registration (337th)
  const latestPaid = paid[0];
  console.log(`\nLatest paid registration: ${latestPaid.inquiryId} | ${latestPaid.husbandName} & ${latestPaid.wifeName} | CreatedAt: ${latestPaid.createdAt}`);

  process.exit(0);
}

run().catch(console.error);
