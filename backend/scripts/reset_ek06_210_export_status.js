import mongoose from 'mongoose';

async function run() {
  await mongoose.connect((process.env.PROD_MONGO_URI || process.env.MONGO_URI));
  const Sub = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));
  
  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];

  // Reset EK06-210 to NOT_EXPORTED
  await Sub.updateOne(
    { inquiryId: 'EK06-210' },
    {
      $set: {
        frameExportStatus: 'NOT_EXPORTED',
        frameExportedAt: null
      }
    }
  );

  console.log('Successfully reset EK06-210 (Bhavesh & Vinal Savani) to NOT_EXPORTED.');

  // Recalculate counts
  const paid = await Sub.find({
    programId: { $in: eventIds },
    $or: [{ status: 'approved' }, { 'payment.status': 'captured' }]
  }).lean();

  const exported = paid.filter(s => s.frameExportStatus === 'EXPORTED');
  const unprinted = paid.filter(s => !s.frameExportStatus || s.frameExportStatus === 'NOT_EXPORTED');

  console.log('\n--- UPDATED COUNTS FOR SURAT 2026-09-07 (PAID COHORT) ---');
  console.log(`Total Paid: ${paid.length}`);
  console.log(`Already Printed: ${exported.length}`);
  console.log(`New / Unprinted: ${unprinted.length}`);

  process.exit(0);
}

run().catch(console.error);
