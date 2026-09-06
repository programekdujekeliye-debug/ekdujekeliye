import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);
  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];

  // Records created or paid on 2026-09-06 between 00:00 and 11:40 AM IST (06:10 UTC)
  const regs = await Registration.find({
    programId: { $in: eventIds },
    status: 'approved',
    createdAt: { $gte: new Date('2026-09-05T18:30:00Z'), $lte: new Date('2026-09-06T06:10:00Z') }
  }).sort({ createdAt: 1 }).lean();

  console.log('Total paid registrations created on morning of Sep 6 up to 11:40 AM:', regs.length);
  regs.forEach(r => {
    console.log(`${r.inquiryId} | ${r.husbandName} & ${r.wifeName} | exported: ${r.frameExportStatus} | paidAt: ${r.payment?.paidAt} | created: ${r.createdAt}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
