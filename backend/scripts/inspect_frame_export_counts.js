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
  console.log('Total approved/paid registrations for EK06:', allPaid.length);

  const statusMap = {};
  allPaid.forEach(r => {
    const s = r.frameExportStatus || 'NOT_EXPORTED';
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  console.log('Breakdown by r.frameExportStatus:', statusMap);

  // Group by frameExportedAt timestamps or date intervals to find the export batches
  const batches = {};
  allPaid.forEach(r => {
    if (r.frameExportedAt) {
      const dt = new Date(r.frameExportedAt).toISOString().substring(0, 16); // group by minute
      batches[dt] = (batches[dt] || 0) + 1;
    }
  });
  console.log('Export batches by minute:', batches);

  // Check if there is any record that was in the 340 batch or if any record was reset
  // Let's check records by inquiryId number
  const inquiryNumbers = allPaid.map(r => {
    const m = r.inquiryId.match(/EK06-(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }).filter(n => n !== null).sort((a,b) => a - b);

  console.log(`Min inquiry ID: EK06-${inquiryNumbers[0]}, Max inquiry ID: EK06-${inquiryNumbers[inquiryNumbers.length - 1]}`);

  // Find exported inquiry numbers
  const exportedInquiryNumbers = allPaid
    .filter(r => r.frameExportStatus === 'EXPORTED')
    .map(r => {
      const m = r.inquiryId.match(/EK06-(\d+)/i);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter(n => n !== null)
    .sort((a, b) => a - b);

  console.log(`Exported count: ${exportedInquiryNumbers.length}`);
  console.log(`Exported min: EK06-${exportedInquiryNumbers[0]}, max: EK06-${exportedInquiryNumbers[exportedInquiryNumbers.length - 1]}`);

  // Find unexported records that are within the range of the exported records!
  const maxExported = exportedInquiryNumbers[exportedInquiryNumbers.length - 1];
  const unexportedInsideRange = allPaid.filter(r => {
    const m = r.inquiryId.match(/EK06-(\d+)/i);
    if (!m) return false;
    const num = parseInt(m[1], 10);
    return num <= maxExported && r.frameExportStatus !== 'EXPORTED';
  });

  console.log(`\nUnexported records with inquiryId <= EK06-${maxExported}:`, unexportedInsideRange.length);
  unexportedInsideRange.forEach(r => {
    console.log(`-> ${r.inquiryId} | Name: ${r.husbandName} & ${r.wifeName} | Status: ${r.status} | frameExportStatus: ${r.frameExportStatus} | photo: ${r.couplePhoto ? 'YES' : 'NO'} | frameExportedAt: ${r.frameExportedAt}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
