import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';

const uri = process.env.PROD_MONGO_URI || process.env.MONGO_URI;

async function main() {
  await mongoose.connect(uri);

  const idsToInspect = [
    'EK06-IP-18', 'EK06-IP-19', 'EK06-IP-20', 'EK06-IP-21', 'EK06-IP-22', 'EK06-IP-23', 'EK06-IP-24', 'EK06-IP-25', 'EK06-IP-26',
    'EK06-IP-99', 'EK06-IP-100', 'EK06-IP-101', 'EK06-IP-102', 'EK06-IP-103', 'EK06-IP-104', 'EK06-IP-108', 'EK06-IP-109'
  ];

  console.log('Inspecting IDs:');
  for (const id of idsToInspect) {
    const r = await Registration.findOne({ inquiryId: id }).lean();
    if (r) {
      console.log(`${r.inquiryId} | ${r.husbandName} & ${r.wifeName} | Phone: ${r.phoneNumber} | Created: ${r.createdAt || r.payment?.createdAt}`);
    } else {
      console.log(`${id} | [NOT IN DB - SKIPPED]`);
    }
  }

  // Let's also check if any records have EK06-IP in other fields or if there are any other registrations for Surat today
  const allSuratToday = await Registration.find({
    programId: { $in: ['prog-2026-09-07', 'surat-7-september-2026'] }
  }).lean();

  console.log(`\nTotal registrations for Surat today: ${allSuratToday.length}`);
  const vipCount = allSuratToday.filter(r => r.isVip).length;
  const nonVipCount = allSuratToday.filter(r => !r.isVip).length;
  console.log(`Surat today VIPs: ${vipCount}, Non-VIPs: ${nonVipCount}`);

  // Let's check how the new VIP entries (103 to 109) were created today
  const recentVips = await Registration.find({
    inquiryId: { $regex: /EK06-IP-(10[0-9])/ }
  }).sort({ inquiryId: 1 }).lean();

  console.log('\nRecent VIPs around 100:');
  for (const r of recentVips) {
    console.log(`${r.inquiryId} | ${r.husbandName} & ${r.wifeName} | Phone: ${r.phoneNumber} | Created: ${r.createdAt || r.payment?.createdAt}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
