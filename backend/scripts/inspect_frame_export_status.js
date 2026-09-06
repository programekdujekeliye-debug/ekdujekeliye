import mongoose from 'mongoose';

async function run() {
  await mongoose.connect((process.env.PROD_MONGO_URI || process.env.MONGO_URI));
  const Sub = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));
  
  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];

  // 1. Sept 4 single export
  const sept4 = await Sub.find({
    programId: { $in: eventIds },
    frameExportStatus: 'EXPORTED',
    frameExportedAt: { $lt: new Date('2026-09-05T00:00:00Z') }
  }).lean();
  console.log('--- Sept 4 (Prior Day) Exported: ---');
  sept4.forEach(s => {
    console.log(`Inquiry: ${s.inquiryId} | Name: ${s.husbandName} & ${s.wifeName} | ExportedAt: ${s.frameExportedAt ? new Date(s.frameExportedAt).toISOString() : 'none'} | Phone: ${s.phoneNumber}`);
  });

  // 2. Sept 5 Batch 2 (the 7 items)
  const sept5Batch2 = await Sub.find({
    programId: { $in: eventIds },
    frameExportStatus: 'EXPORTED',
    frameExportedAt: {
      $gte: new Date('2026-09-05T11:20:00Z'),
      $lte: new Date('2026-09-05T11:30:00Z')
    }
  }).lean();
  console.log('\n--- Sept 5 Batch 2 (7 items): ---');
  sept5Batch2.forEach(s => {
    console.log(`Inquiry: ${s.inquiryId} | Name: ${s.husbandName} & ${s.wifeName} | ExportedAt: ${s.frameExportedAt ? new Date(s.frameExportedAt).toISOString() : 'none'} | Phone: ${s.phoneNumber}`);
  });

  // 3. Sept 5 Batch 1 (the 293 items)
  const sept5Batch1Count = await Sub.countDocuments({
    programId: { $in: eventIds },
    frameExportStatus: 'EXPORTED',
    frameExportedAt: {
      $gte: new Date('2026-09-05T11:00:00Z'),
      $lte: new Date('2026-09-05T11:10:00Z')
    }
  });
  console.log(`\n--- Sept 5 Batch 1: ${sept5Batch1Count} items ---`);

  // Total exported count
  const total = await Sub.countDocuments({
    programId: { $in: eventIds },
    frameExportStatus: 'EXPORTED'
  });
  console.log(`\nTotal EXPORTED in DB: ${total}`);

  process.exit(0);
}

run().catch(console.error);
