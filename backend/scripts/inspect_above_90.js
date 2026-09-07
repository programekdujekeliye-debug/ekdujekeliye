import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';

const uri = process.env.PROD_MONGO_URI || process.env.MONGO_URI;

async function main() {
  await mongoose.connect(uri);

  const vips = await Registration.find({
    inquiryId: { $regex: /EK06-IP-(\d+)/ }
  }).sort({ inquiryId: 1 }).lean();

  const above90 = [];
  for (const v of vips) {
    const m = v.inquiryId.match(/EK06-IP-(\d+)/);
    if (m && parseInt(m[1], 10) >= 90) {
      above90.push({
        num: parseInt(m[1], 10),
        id: v.inquiryId,
        name: `${v.husbandName} & ${v.wifeName} ${v.surname || ''}`,
        phone: v.phoneNumber,
        created: v.createdAt || v.payment?.createdAt
      });
    }
  }

  above90.sort((a, b) => a.num - b.num);
  console.log(`VIP passes with number >= 90 (Total: ${above90.length}):`);
  for (const a of above90) {
    console.log(`${a.id} (#${a.num}) | ${a.name} | ${a.phone} | ${a.created}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
