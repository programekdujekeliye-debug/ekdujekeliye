import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);

  const ids = ['EK06-40', 'EK06-210', 'EK06-251', 'EK06-IP-05'];
  const regs = await Registration.find({ inquiryId: { $in: ids } }).lean();

  console.log('Inspection of old inquiries exported in Batch 2:');
  regs.forEach(r => {
    console.log({
      inquiryId: r.inquiryId,
      names: `${r.husbandName} & ${r.wifeName}`,
      createdAt: r.createdAt,
      paidAt: r.payment?.paidAt,
      frameExportedAt: r.frameExportedAt
    });
  });

  await mongoose.disconnect();
}

main().catch(console.error);
