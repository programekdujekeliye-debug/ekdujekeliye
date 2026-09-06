import mongoose from 'mongoose';

async function run() {
  const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('--- 1. RENAMING DELETED TEST CONFLICT RECORD ---');
  // Free up EK06-05 from deleted test record
  await db.collection('submission').updateOne(
    { inquiryId: 'EK06-05', isDeleted: true },
    { $set: { inquiryId: 'EK06-05-TEST-DELETED-OLD' } }
  );

  console.log('--- 2. UPDATING DIVYESH & SNEHAL VARSANI TO EK06-05 ---');
  const updateRes = await db.collection('submission').updateOne(
    { phoneNumber: '9974446563' },
    {
      $set: {
        inquiryId: 'EK06-05',
        programId: 'prog-2026-09-07',
        programDate: '2026-09-07',
        programName: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
        isDeleted: false
      }
    }
  );
  console.log(`Updated Divyesh & Snehal Varsani: matched ${updateRes.matchedCount}, modified ${updateRes.modifiedCount}`);

  console.log('--- 3. STANDARDIZING ALL 7 SEPTEMBER REGISTRATIONS ---');
  await db.collection('submission').updateMany(
    { programDate: '2026-09-07', isDeleted: { $ne: true } },
    {
      $set: {
        programId: 'prog-2026-09-07',
        programDate: '2026-09-07',
        programName: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan'
      }
    }
  );

  // Synchronize Pass & WhatsappMessage
  await db.collection('pass').updateMany({ inquiryId: 'EK01-05' }, { $set: { inquiryId: 'EK06-05' } });
  await db.collection('whatsapp_message').updateMany(
    { inquiryId: 'EK01-05' },
    { $set: { inquiryId: 'EK06-05', eventId: 'prog-2026-09-07' } }
  );
  console.log('  ✓ Synchronized Pass and WhatsApp message collections.');

  console.log('--- 4. VERIFYING 7 SEPTEMBER 2026 REGISTRATIONS ---');
  const sept7Regs = await db.collection('submission')
    .find({ programDate: '2026-09-07', isDeleted: { $ne: true } })
    .sort({ inquiryId: 1 })
    .toArray();

  console.log(`Total 7 September 2026 active registrations: ${sept7Regs.length}`);
  sept7Regs.forEach(r => {
    console.log(`  ✓ [${r.inquiryId}] ${r.husbandName} & ${r.wifeName} ${r.surname} (${r.phoneNumber}) - Status: ${r.status}`);
  });

  process.exit(0);
}

run().catch(console.error);
