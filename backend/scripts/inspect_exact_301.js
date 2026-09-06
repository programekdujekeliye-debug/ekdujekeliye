import mongoose from 'mongoose';

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('[SECURITY ERROR] MONGO_URI is required.');
  }
  await mongoose.connect(mongoUri);
  const Sub = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));
  
  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];

  // All paid submissions for event
  const paid = await Sub.find({
    programId: { $in: eventIds },
    $or: [{ status: 'approved' }, { 'payment.status': 'captured' }]
  }).lean();

  console.log(`Total Paid Submissions: ${paid.length}`);

  const exported = paid.filter(s => s.frameExportStatus === 'EXPORTED');
  console.log(`Total Paid & EXPORTED: ${exported.length}`);

  // Count by date string of frameExportedAt
  const byDate = {};
  exported.forEach(s => {
    const dStr = s.frameExportedAt ? new Date(s.frameExportedAt).toISOString().split('T')[0] : 'NO_DATE';
    byDate[dStr] = (byDate[dStr] || 0) + 1;
  });
  console.log('Exported by Date:', byDate);

  // Print all that are NOT in the 2026-09-05 batches
  const nonSept5 = exported.filter(s => {
    if (!s.frameExportedAt) return true;
    const iso = new Date(s.frameExportedAt).toISOString();
    return !iso.startsWith('2026-09-05');
  });

  console.log(`Non-Sept 5 exported count: ${nonSept5.length}`);
  nonSept5.forEach(s => {
    console.log(`ID: ${s.inquiryId}, Name: ${s.husbandName} & ${s.wifeName}, ExportedAt: ${s.frameExportedAt}, Status: ${s.status}, CreatedAt: ${s.createdAt}`);
  });

  process.exit(0);
}

run().catch(console.error);
