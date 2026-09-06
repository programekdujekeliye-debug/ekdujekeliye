import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  const uri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(uri);

  // Exact query from registration controller for getSubmissions
  const eventIds = ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'];
  const query = {
    $or: [
      { programId: { $in: eventIds } },
      { eventId: { $in: eventIds } }
    ]
  };

  const all = await Registration.find(query).lean();
  console.log('Total submissions for 2026-09-07 event:', all.length);

  const paid = all.filter(s => s.status === 'approved' || s.payment?.status === 'captured');
  console.log('Total Paid submissions for 2026-09-07:', paid.length);

  const exported = paid.filter(s => s.frameExportStatus === 'EXPORTED');
  const unprinted = paid.filter(s => !s.frameExportStatus || s.frameExportStatus === 'NOT_EXPORTED');
  const modified = paid.filter(s => s.frameExportStatus === 'MODIFIED');

  console.log(`Already Printed (EXPORTED): ${exported.length}`);
  console.log(`New / Unprinted (NOT_EXPORTED): ${unprinted.length}`);
  console.log(`Adjusted (MODIFIED): ${modified.length}`);
  console.log(`Sum: ${exported.length} + ${unprinted.length} + ${modified.length} = ${exported.length + unprinted.length + modified.length}`);

  // Now let's list every single exported record sorted by inquiryId
  console.log('\n--- ALL 339 EXPORTED INQUIRY IDS ---');
  const exportedIds = exported.map(s => s.inquiryId).sort();
  console.log(exportedIds.join(', '));

  // Check if any record in paid has a photo issue or error
  const noPhoto = paid.filter(s => !s.couplePhoto);
  console.log('\nPaid couples with NO photo:', noPhoto.map(s => s.inquiryId));

  await mongoose.disconnect();
}

main().catch(console.error);
