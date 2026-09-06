import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);

  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];
  const query = {
    $or: [
      { programId: { $in: eventIds } },
      { eventId: { $in: eventIds } }
    ],
    $or: [
      { status: 'approved' },
      { 'payment.status': 'captured' }
    ],
    $or: [
      { frameExportStatus: { $in: [null, 'NOT_EXPORTED'] } },
      { frameExportStatus: { $exists: false } }
    ]
  };

  const unprinted = await Registration.find({
    programId: { $in: eventIds },
    status: 'approved',
    $or: [
      { frameExportStatus: { $in: [null, 'NOT_EXPORTED'] } },
      { frameExportStatus: { $exists: false } }
    ]
  }).sort({ inquiryId: 1 }).lean();

  console.log(`Total Unprinted Paid for Sept 7: ${unprinted.length}`);
  console.log('List of all unprinted inquiries:');
  unprinted.forEach(r => {
    console.log(`${r.inquiryId} | ${r.husbandName} & ${r.wifeName} | Paid: ${r.payment?.paidAt || r.createdAt}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
