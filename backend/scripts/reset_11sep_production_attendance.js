/**
 * Operational Script: Reset Gate Scanner Attendance for September 11, 2026 Event
 *
 * Purpose:
 *   Clears test check-ins and attendance records for the 11 September 2026 event
 *   in production, restoring all passes and registrations to clean, unmarked state.
 *
 * Collections affected:
 *   - submission (resets attendance to 'unmarked', unsets attendanceAt, attendanceMethod, etc.)
 *   - passes (resets firstScannedAt, lastScannedAt, scanCount, firstScannedBy)
 *   - scan_records (removes test scan logs for this event)
 *
 * Environment:
 *   Production (or test if MONGO_URI is set)
 *
 * Safety Guards:
 *   - Strictly scoped to eventId: 'prog-2026-09-11' / date: '2026-09-11'.
 *   - Refuses execution unless '--execute' flag is explicitly supplied.
 *   - Defaults to safe dry-run preview.
 *   - Verifies before and after counts.
 *
 * Rollback:
 *   Passes and registrations can be re-scanned or manual attendance marked via admin dashboard.
 */

import { MongoClient } from 'mongodb';

const uri = process.env.PROD_MONGO_URI || process.env.MONGO_URI;

if (!uri) {
  console.error('[ERROR] No database URI provided. Set PROD_MONGO_URI or MONGO_URI.');
  process.exit(1);
}

const isExecute = process.argv.includes('--execute');
const TARGET_EVENT_ID = 'prog-2026-09-11';
const TARGET_EVENT_DATE = '2026-09-11';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  const dbName = uri.split('/').pop().split('?')[0];
  console.log('====================================================');
  console.log(`OPERATIONAL SCRIPT: RESET 11 SEPTEMBER ATTENDANCE`);
  console.log(`Database Target: ${dbName}`);
  console.log(`Mode: ${isExecute ? '*** LIVE EXECUTION ***' : 'DRY RUN (preview only)'}`);
  console.log(`Target Event ID: ${TARGET_EVENT_ID}`);
  console.log(`Target Event Date: ${TARGET_EVENT_DATE}`);
  console.log('====================================================\n');

  const db = client.db(dbName);

  // 1. Inspect Event
  const event = await db.collection('program').findOne({
    $or: [{ id: TARGET_EVENT_ID }, { date: TARGET_EVENT_DATE }]
  }) || await db.collection('events').findOne({
    $or: [{ id: TARGET_EVENT_ID }, { date: TARGET_EVENT_DATE }]
  });

  if (!event) {
    console.error(`[ERROR] Target event not found for ${TARGET_EVENT_ID} / ${TARGET_EVENT_DATE}`);
    await client.close();
    process.exit(1);
  }

  console.log(`Event Identified: "${event.name}" (ID: ${event.id}, Date: ${event.date})\n`);

  // 2. Identify Cohort: Submissions
  const submissionQuery = {
    $or: [
      { programId: TARGET_EVENT_ID },
      { programDate: TARGET_EVENT_DATE }
    ],
    isDeleted: { $ne: true }
  };

  const totalEventRegs = await db.collection('submission').countDocuments(submissionQuery);
  const presentRegs = await db.collection('submission').find({
    ...submissionQuery,
    attendance: 'present'
  }).toArray();

  console.log(`[Submission Cohort]`);
  console.log(`- Total active registrations for event: ${totalEventRegs}`);
  console.log(`- Currently marked PRESENT: ${presentRegs.length}`);
  presentRegs.forEach(r => {
    console.log(`  * ${r.inquiryId} - ${r.husbandName} & ${r.wifeName} ${r.surname} (Method: ${r.attendanceMethod || 'N/A'}, At: ${r.attendanceAt || 'N/A'})`);
  });

  // 3. Identify Cohort: Passes
  const passQuery = {
    $or: [
      { eventId: TARGET_EVENT_ID },
      { eventDate: TARGET_EVENT_DATE }
    ]
  };

  const totalEventPasses = await db.collection('passes').countDocuments(passQuery);
  const scannedPasses = await db.collection('passes').find({
    ...passQuery,
    firstScannedAt: { $ne: null }
  }).toArray();

  console.log(`\n[Pass Cohort]`);
  console.log(`- Total passes for event: ${totalEventPasses}`);
  console.log(`- Currently scanned passes: ${scannedPasses.length}`);
  scannedPasses.forEach(p => {
    console.log(`  * Pass ${p.passId} (${p.inquiryId}) - First scanned: ${p.firstScannedAt}, Count: ${p.scanCount}`);
  });

  // 4. Identify Cohort: ScanRecords
  const scanRecordQuery = {
    $or: [
      { eventId: TARGET_EVENT_ID },
      { eventDate: TARGET_EVENT_DATE }
    ]
  };

  const scanRecordCount = await db.collection('scan_records').countDocuments(scanRecordQuery);
  console.log(`\n[Scan Records]`);
  console.log(`- Audit scan records logged for event: ${scanRecordCount}`);

  if (!isExecute) {
    console.log('\n----------------------------------------------------');
    console.log('DRY RUN COMPLETE. No data was modified.');
    console.log('To execute the reset on production, re-run with:');
    console.log('  node --env-file=.env scripts/reset_11sep_production_attendance.js --execute');
    console.log('----------------------------------------------------');
    await client.close();
    process.exit(0);
  }

  // EXECUTE MUTATION
  console.log('\nExecuting attendance reset...');

  // A. Reset Submissions
  const regUpdateRes = await db.collection('submission').updateMany(
    submissionQuery,
    {
      $set: { attendance: 'unmarked' },
      $unset: {
        attendanceAt: '',
        attendanceMethod: '',
        checkedIn: '',
        checkedInAt: '',
        admittedAt: '',
        scannedBy: '',
        gateNumber: ''
      }
    }
  );
  console.log(`✓ Submissions updated: ${regUpdateRes.modifiedCount} modified (out of ${regUpdateRes.matchedCount} matched)`);

  // B. Reset Passes
  const passUpdateRes = await db.collection('passes').updateMany(
    passQuery,
    {
      $set: {
        firstScannedAt: null,
        lastScannedAt: null,
        scanCount: 0
      },
      $unset: {
        firstScannedBy: ''
      }
    }
  );
  console.log(`✓ Passes reset: ${passUpdateRes.modifiedCount} modified (out of ${passUpdateRes.matchedCount} matched)`);

  // C. Delete ScanRecords
  const scanDeleteRes = await db.collection('scan_records').deleteMany(scanRecordQuery);
  console.log(`✓ Scan records deleted: ${scanDeleteRes.deletedCount}`);

  // D. Post-mutation Verification
  const remainingPresent = await db.collection('submission').countDocuments({
    ...submissionQuery,
    attendance: 'present'
  });
  const remainingScannedPasses = await db.collection('passes').countDocuments({
    ...passQuery,
    firstScannedAt: { $ne: null }
  });
  const remainingScanRecords = await db.collection('scan_records').countDocuments(scanRecordQuery);

  console.log('\n====================================================');
  console.log('POST-RESET VERIFICATION REPORT:');
  console.log(`- Remaining submissions marked present: ${remainingPresent} (Expected: 0)`);
  console.log(`- Remaining scanned passes: ${remainingScannedPasses} (Expected: 0)`);
  console.log(`- Remaining scan records: ${remainingScanRecords} (Expected: 0)`);
  console.log('====================================================');

  if (remainingPresent === 0 && remainingScannedPasses === 0 && remainingScanRecords === 0) {
    console.log('SUCCESS: Attendance for September 11, 2026 event is completely reset and clean for tonight!');
  } else {
    console.warn('WARNING: Some records could not be reset. Review database state.');
  }

  await client.close();
}

main().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
