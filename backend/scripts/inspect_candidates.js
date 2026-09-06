import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);

  const testIds = ['EK06-449', 'EK06-467', 'EK06-468', 'EK06-471', 'EK06-474', 'EK06-248'];
  const regs = await Registration.find({ inquiryId: { $in: testIds } }).lean();

  console.log('Detailed inspection of candidate records:');
  regs.forEach(r => {
    console.log({
      inquiryId: r.inquiryId,
      names: `${r.husbandName} & ${r.wifeName}`,
      status: r.status,
      paymentStatus: r.payment?.status,
      paymentAmount: r.payment?.amount,
      createdAt: r.createdAt,
      approvedAt: r.approvedAt || r.payment?.capturedAt || r.payment?.verifiedAt,
      couplePhoto: r.couplePhoto ? r.couplePhoto.substring(0, 60) : 'NONE',
      frameExportStatus: r.frameExportStatus,
      frameExportedAt: r.frameExportedAt
    });
  });

  await mongoose.disconnect();
}

main().catch(console.error);
