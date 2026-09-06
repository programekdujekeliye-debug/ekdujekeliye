import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);

  const checkIds = [
    'EK06-440', 'EK06-446', 'EK06-449', 'EK06-452', 'EK06-455',
    'EK06-458', 'EK06-460', 'EK06-463', 'EK06-464', 'EK06-465',
    'EK06-466', 'EK06-467', 'EK06-468', 'EK06-469', 'EK06-471', 'EK06-473'
  ];

  const found = await Registration.find({ inquiryId: { $in: checkIds } }).lean();

  console.log('Results for missing numbers:');
  checkIds.forEach(id => {
    const r = found.find(f => f.inquiryId === id);
    if (!r) {
      console.log(`${id}: DOES NOT EXIST IN DATABASE (skipped number / failed initiation)`);
    } else {
      console.log(`${id}: status="${r.status}" | pay="${r.payment?.status}" | photo="${r.couplePhoto ? 'YES' : 'NO'}" | export="${r.frameExportStatus}" | name="${r.husbandName} & ${r.wifeName}"`);
    }
  });

  await mongoose.disconnect();
}

main().catch(console.error);
