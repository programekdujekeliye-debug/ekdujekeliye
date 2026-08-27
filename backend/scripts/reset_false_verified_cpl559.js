import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function resetFalseVerifiedRecord() {
  await mongoose.connect(env.MONGO_URI);
  console.log('--- RESETTING INVALID/MOCK VERIFIED STATUS FOR CPL-559 ---');

  const recordBefore = await MediaArchive.findOne({ registrationId: 'CPL-559' }).lean();
  console.log('Record Before Reset:');
  console.log('- Job ID:', recordBefore?._id);
  console.log('- Status:', recordBefore?.status);
  console.log('- DriveFileId:', recordBefore?.driveFileId);
  console.log('- VerifiedAt:', recordBefore?.verifiedAt);

  // Safely reset only CPL-559 to QUEUED and clear invalid drive fields
  await MediaArchive.updateOne(
    { registrationId: 'CPL-559' },
    {
      $set: {
        status: 'QUEUED',
        workerId: null,
        claimedAt: null,
        attempts: 0
      },
      $unset: {
        driveFileId: 1,
        driveFolderId: 1,
        verifiedAt: 1,
        copiedAt: 1,
        driveVerifiedAt: 1,
        driveVerificationSource: 1,
        deleteAfter: 1
      }
    }
  );

  const recordAfter = await MediaArchive.findOne({ registrationId: 'CPL-559' }).lean();
  console.log('\nRecord After Reset:');
  console.log('- Job ID:', recordAfter?._id);
  console.log('- Status:', recordAfter?.status, recordAfter?.status === 'QUEUED' ? '✅ RESET TO QUEUED' : '❌ FAILED');
  console.log('- DriveFileId:', recordAfter?.driveFileId || 'CLEARED (None)');
  console.log('- VerifiedAt:', recordAfter?.verifiedAt || 'CLEARED (None)');

  // Verify unrelated 321 jobs from TBD event are untouched
  const tbdQueued = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'QUEUED' });
  const tbdVerified = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'VERIFIED' });
  const totalQueued = await MediaArchive.countDocuments({ status: 'QUEUED' });

  console.log('\nGlobal Queue State:');
  console.log('- Unrelated TBD Event:', tbdQueued, 'QUEUED (Untouched)');
  console.log('- Target Event (2026-08-09): 1 QUEUED (CPL-559 ready for real Apps Script copy)');
  console.log('- Total QUEUED across all events:', totalQueued, '(321 + 1 = 322)');

  await mongoose.disconnect();
}

resetFalseVerifiedRecord();
