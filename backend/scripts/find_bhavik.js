import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);

  const byName = await Registration.find({
    $or: [
      { husbandName: /Bhavik/i },
      { wifeName: /Nikhita/i },
      { surname: /Donga/i }
    ]
  }).lean();

  console.log('Found by name Bhavik/Nikhita/Donga:', byName.length);
  byName.forEach(r => {
    console.log({
      inquiryId: r.inquiryId,
      name: `${r.husbandName} & ${r.wifeName} ${r.surname}`,
      phone: r.phoneNumber,
      event: r.eventId || r.programId,
      status: r.status,
      previousInquiryId: r.previousInquiryId,
      transferHistory: r.transferHistory,
      frameExportStatus: r.frameExportStatus,
      frameExportedAt: r.frameExportedAt
    });
  });

  // Also check other collections in DB (like 'submissions' or 'registrations_backup' or deleted records)
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('All collections:', collections.map(c => c.name));

  for (const c of collections) {
    const doc = await mongoose.connection.db.collection(c.name).findOne({ inquiryId: 'EK06-412' });
    if (doc) {
      console.log(`Found EK06-412 in collection "${c.name}":`, doc);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
