import mongoose from 'mongoose';

async function run() {
  console.log('[Cleanup Script] Connecting to database...');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('[SECURITY ERROR] MONGO_URI is required.');
  }
  await mongoose.connect(mongoUri);
  const Sub = mongoose.model('Submission', new mongoose.Schema({}, { collection: 'submission', strict: false }));

  // Find all unpaid or rejected records that have frameExportStatus = 'EXPORTED'
  const query = {
    status: { $ne: 'approved' },
    'payment.status': { $ne: 'captured' },
    frameExportStatus: 'EXPORTED'
  };

  const count = await Sub.countDocuments(query);
  console.log(`[Cleanup Script] Found ${count} unpaid/rejected submissions with frameExportStatus: 'EXPORTED'.`);

  if (count > 0) {
    const result = await Sub.updateMany(query, {
      $set: {
        frameExportStatus: 'NOT_EXPORTED',
        frameExportedAt: null
      }
    });
    console.log(`[Cleanup Script] Cleaned up ${result.modifiedCount} records. Their frame status is now NOT_EXPORTED.`);
  }

  // Verify across all events
  const remainingUnpaidExported = await Sub.countDocuments(query);
  console.log(`[Cleanup Script] Remaining unpaid with EXPORTED: ${remainingUnpaidExported}`);

  process.exit(0);
}

run().catch(err => {
  console.error('[Cleanup Script Error]:', err);
  process.exit(1);
});
