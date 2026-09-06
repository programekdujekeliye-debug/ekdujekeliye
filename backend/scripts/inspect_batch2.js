import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);

  const filter = {
    $or: [
      { inquiryId: /^EK06/i },
      { eventId: /^EK06/i }
    ],
    status: 'approved'
  };

  const allPaid = await Registration.find(filter).lean();

  console.log('--- Batch 2 (around 2026-09-06T06:05) ---');
  const batch2 = allPaid.filter(r => r.frameExportedAt && new Date(r.frameExportedAt) >= new Date('2026-09-06T05:00:00Z'));
  console.log(`Count in Batch 2: ${batch2.length}`);
  batch2.forEach(r => {
    console.log(`Exported: ${r.inquiryId} | ${r.husbandName} & ${r.wifeName} | ExportedAt: ${r.frameExportedAt}`);
  });

  // Check records created or updated around the same time that were NOT exported:
  console.log('\n--- Unexported records with inquiryId between EK06-400 and EK06-480 ---');
  const unexportedNear = allPaid.filter(r => {
    const m = r.inquiryId.match(/EK06-(\d+)/i);
    if (!m) return false;
    const num = parseInt(m[1], 10);
    return num >= 400 && num <= 480 && r.frameExportStatus !== 'EXPORTED';
  });
  unexportedNear.forEach(r => {
    console.log(`Unexported candidate: ${r.inquiryId} | ${r.husbandName} & ${r.wifeName} | CreatedAt: ${r.createdAt} | UpdatedAt: ${r.updatedAt} | Photo: ${r.couplePhoto}`);
  });

  // Check if any record has frameExportStatus === 'EXPORTED' but frameExportedAt is null
  const exportedNoTime = allPaid.filter(r => r.frameExportStatus === 'EXPORTED' && !r.frameExportedAt);
  console.log(`\nExported but no frameExportedAt timestamp: ${exportedNoTime.length}`);

  // Check if any record has frameAdjustment
  const adjusted = allPaid.filter(r => r.frameAdjustment && Object.keys(r.frameAdjustment).length > 0);
  console.log(`Adjusted records: ${adjusted.length}`);

  await mongoose.disconnect();
}

main().catch(console.error);
