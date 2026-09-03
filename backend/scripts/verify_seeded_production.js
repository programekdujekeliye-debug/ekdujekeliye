import mongoose from 'mongoose';

const PROD_MONGO_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function verify() {
  console.log('--- STARTING THOROUGH POST-SEEDING VERIFICATION ---');
  await mongoose.connect(PROD_MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Verify All Programs
  const allProgs = await db.collection('program').find({}).sort({ date: 1 }).toArray();
  console.log(`\n1. ALL PROGRAMS IN DB (${allProgs.length} Total):`);
  allProgs.forEach(p => {
    console.log(`- [${p.id}] Date: ${p.date} | Name: "${p.name}" | Status: ${p.status} | Price: ₹${p.price} | Bookings: ${p.bookingsCount}`);
  });

  // 2. Verify Submissions by Program Date
  const subSummary = await db.collection('submission').aggregate([
    { $group: { _id: '$programDate', count: { $sum: 1 }, programId: { $first: '$programId' } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  console.log('\n2. SUBMISSION COUNTS BY DATE:');
  subSummary.forEach(s => {
    console.log(`- Date: ${s._id.padEnd(12)} | Count: ${String(s.count).padStart(4)} | Program ID: ${s.programId}`);
  });

  // 3. Verify Specific Seeded Dates
  const checks = [
    { date: '2026-06-27', expected: 269, prefix: 'CPL1' },
    { date: '2026-07-10', expected: 228, prefix: 'CPL2' },
    { date: '2026-07-24', expected: 245, prefix: 'CPL3' },
    { date: '2026-08-04', expected: 440, prefix: 'CPL4' }
  ];

  console.log('\n3. VERIFYING SEEDED EVENTS INTEGRITY:');
  for (const c of checks) {
    const count = await db.collection('submission').countDocuments({ programDate: c.date });
    const prefixCount = await db.collection('submission').countDocuments({ inquiryId: new RegExp(`^${c.prefix}-`) });
    const approvedCount = await db.collection('submission').countDocuments({ programDate: c.date, status: 'approved' });
    const paidCount = await db.collection('submission').countDocuments({ programDate: c.date, 'payment.status': 'captured', amount: 1000 });
    const sample = await db.collection('submission').findOne({ inquiryId: `${c.prefix}-001` });

    console.log(`\n  [${c.date} - ${c.prefix}]`);
    console.log(`    Total Count: ${count} (Expected: ${c.expected}) -> ${count === c.expected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Prefix Match: ${prefixCount} (Expected: ${c.expected}) -> ${prefixCount === c.expected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Approved Count: ${approvedCount} -> ${approvedCount === c.expected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Paid ₹1000 Count: ${paidCount} -> ${paidCount === c.expected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Sample (${sample?.inquiryId}): "${sample?.husbandName} & ${sample?.wifeName} ${sample?.surname}" | Phone: ${sample?.phoneNumber} | Photo: ${sample?.couplePhoto}`);
  }

  // 4. Verify Existing Events Were Unharmed
  console.log('\n4. VERIFYING PRE-EXISTING EVENTS REMAIN UNTOUCHED:');
  const existingExpected = [
    { date: '2026-08-07', expected: 594 },
    { date: '2026-08-09', expected: 233 },
    { date: '2026-08-21', expected: 252 },
    { date: '2026-08-27', expected: 615 },
    { date: '2026-09-07', expected: 313 }, // 311 + 2
    { date: '2026-09-11', expected: 194 },
    { date: 'TBD', expected: 660 }
  ];

  for (const ex of existingExpected) {
    const count = await db.collection('submission').countDocuments({ programDate: ex.date });
    console.log(`  Existing Date ${ex.date.padEnd(12)}: Count = ${count} (Expected: ${ex.expected}) -> ${count === ex.expected ? '✅ UNTOUCHED' : '⚠️ MISMATCH'}`);
  }

  // 5. Verify Counters
  console.log('\n5. VERIFYING COUNTERS:');
  for (const c of checks) {
    const counterKey = `inquiryNumber_prog-${c.date}`;
    const counterDoc = await db.collection('counter').findOne({ _id: counterKey });
    console.log(`  Counter '${counterKey}': seq = ${counterDoc?.seq} (Expected: ${c.expected}) -> ${counterDoc?.seq === c.expected ? '✅ PASS' : '❌ FAIL'}`);
  }

  await mongoose.disconnect();
  console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
}

verify().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
