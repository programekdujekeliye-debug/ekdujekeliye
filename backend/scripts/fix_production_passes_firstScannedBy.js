import mongoose from 'mongoose';

const PROD_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function fix() {
  console.log('Connecting to production database...');
  await mongoose.connect(PROD_URI);
  const db = mongoose.connection.db;

  // 1. Reset the test pass EDKL-P-11DFC60E516B27 that we used in diagnostic
  const testPass = await db.collection('passes').findOne({ passId: 'EDKL-P-11DFC60E516B27' });
  if (testPass) {
    await db.collection('passes').updateOne(
      { passId: 'EDKL-P-11DFC60E516B27' },
      {
        $set: {
          firstScannedAt: null,
          lastScannedAt: null,
          scanCount: 0
        },
        $unset: { firstScannedBy: '' }
      }
    );
    if (testPass.registrationId) {
      await db.collection('registrations').updateOne(
        { _id: testPass.registrationId },
        {
          $set: { attendance: 'unmarked' },
          $unset: { attendanceAt: '', attendanceMethod: '' }
        }
      );
    }
    await db.collection('scan_records').deleteMany({ scanId: { $regex: /^SCAN-test/i } });
    console.log('Reset test pass EDKL-P-11DFC60E516B27 successfully.');
  }

  // 2. Unset all firstScannedBy: null in passes collection
  const res = await db.collection('passes').updateMany(
    { firstScannedBy: null },
    { $unset: { firstScannedBy: '' } }
  );
  console.log(`Unset firstScannedBy on ${res.modifiedCount} passes.`);

  // 3. Verify remaining count
  const remaining = await db.collection('passes').countDocuments({ firstScannedBy: null });
  console.log(`Remaining passes with firstScannedBy: null: ${remaining}`);

  await mongoose.disconnect();
}

fix().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
