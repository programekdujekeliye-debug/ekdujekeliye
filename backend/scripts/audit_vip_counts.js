import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';

const uri = process.env.PROD_MONGO_URI || process.env.MONGO_URI;

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Find all VIP records for Surat 07-09-2026 or with inquiryId matching EK06-IP
  const vips = await Registration.find({
    $or: [
      { inquiryId: { $regex: /EK06-IP-/ } },
      { isVip: true, programId: { $in: ['prog-2026-09-07', 'surat-7-september-2026'] } }
    ]
  }).sort({ inquiryId: 1 }).lean();

  console.log(`\nTotal matching VIPs found in DB: ${vips.length}`);

  // Extract all numbers from EK06-IP-<num>
  const nums = [];
  const mapByNum = new Map();
  const nonMatching = [];

  for (const v of vips) {
    const m = v.inquiryId?.match(/EK06-IP-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      nums.push(n);
      if (!mapByNum.has(n)) {
        mapByNum.set(n, []);
      }
      mapByNum.get(n).push(v);
    } else {
      nonMatching.push(v);
    }
  }

  nums.sort((a, b) => a - b);
  const min = nums[0];
  const max = nums[nums.length - 1];

  console.log(`Min VIP number: ${min}`);
  console.log(`Max VIP number: ${max}`);
  console.log(`Unique VIP numbers count: ${mapByNum.size}`);
  console.log(`Total VIP records count: ${nums.length}`);

  // Find missing numbers between 1 and max
  const missing = [];
  for (let i = 1; i <= max; i++) {
    if (!mapByNum.has(i)) {
      missing.push(i);
    }
  }

  console.log('\n================ MISSING NUMBERS BETWEEN 1 AND ' + max + ' ================');
  console.log(`Missing count: ${missing.length}`);
  console.log(`Missing numbers: ${missing.join(', ')}`);
  console.log(`Missing IDs: ${missing.map(n => `EK06-IP-${n}`).join(', ')}`);

  // Check if any numbers are duplicated in DB
  const duplicates = [];
  for (const [n, list] of mapByNum.entries()) {
    if (list.length > 1) {
      duplicates.push({ num: n, count: list.length, items: list.map(l => ({ id: l.inquiryId, name: `${l.husbandName} & ${l.wifeName}`, phone: l.phoneNumber })) });
    }
  }

  if (duplicates.length > 0) {
    console.log('\n================ DUPLICATE NUMBERS IN DB ================');
    console.log(JSON.stringify(duplicates, null, 2));
  } else {
    console.log('\nNo duplicate numbers found in DB.');
  }

  // Let's check if the missing IDs exist anywhere in MongoDB with any filter (even deleted, or non-VIP)
  console.log('\n================ CHECKING IF MISSING IDs EXIST ANYWHERE ================');
  for (const n of missing) {
    const id = `EK06-IP-${n}`;
    const any = await Registration.findOne({ inquiryId: id }).lean();
    if (any) {
      console.log(`${id} EXISTS: isVip=${any.isVip}, status=${any.status}, isDeleted=${any.isDeleted}, name=${any.husbandName} & ${any.wifeName}, phone=${any.phoneNumber}`);
    } else {
      console.log(`${id} DOES NOT EXIST ANYWHERE in database! (Gap in numbering)`);
    }
  }

  // Check the frontend filter in VipPassesPage.tsx:
  // How does VipPassesPage filter?
  // Let's see: totalVipCount = vipGuests.length
  // What API does VipPassesPage call?
  console.log('\n================ STATUS BREAKDOWN ================');
  const statusCounts = {};
  for (const v of vips) {
    statusCounts[v.status] = (statusCounts[v.status] || 0) + 1;
  }
  console.log('By status:', statusCounts);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
