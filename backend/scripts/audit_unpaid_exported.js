import mongoose from 'mongoose';

async function run() {
  await mongoose.connect((process.env.PROD_MONGO_URI || process.env.MONGO_URI));
  const Sub = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));
  
  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];

  const unpaidExported = await Sub.find({
    programId: { $in: eventIds },
    status: { $ne: 'approved' },
    'payment.status': { $ne: 'captured' },
    frameExportStatus: 'EXPORTED'
  }).lean();

  console.log(`Unpaid submissions currently marked as EXPORTED: ${unpaidExported.length}`);
  unpaidExported.forEach(u => {
    console.log(`- ${u.inquiryId} | ${u.husbandName} & ${u.wifeName} | Status: ${u.status} | ExportedAt: ${u.frameExportedAt}`);
  });

  process.exit(0);
}

run().catch(console.error);
