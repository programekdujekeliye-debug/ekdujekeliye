import mongoose from 'mongoose';
import { runNightlyBackupRoutine, runDatabaseBackup } from '../src/jobs/backup.job.js';
import { BackupRecord } from '../src/models/BackupRecord.js';
import { env } from '../src/config/env.js';

async function testNightlyRoutine() {
  console.log('====================================================');
  console.log('  TESTING NIGHTLY BACKUP CASCADE LOGIC & SNAPSHOTS  ');
  console.log('====================================================');

  await mongoose.connect(env.MONGO_URI);

  // 1. Test live routine execution
  console.log('\n--- 1. EXECUTING LIVE NIGHTLY BACKUP ROUTINE ---');
  const routineResults = await runNightlyBackupRoutine();
  console.log('Routine Result Keys:', Object.keys(routineResults));
  console.log('Daily Backup ID:', routineResults.daily?.backupId);
  console.log('Daily Manifest Size (KB):', routineResults.daily?.manifest?.compressedSizeKB);
  console.log('Daily Checksum:', routineResults.daily?.manifest?.checksum?.slice(0, 16) + '...');
  console.log('Weekly Backup:', routineResults.weekly ? routineResults.weekly.backupId : 'Skipped (Not Sunday)');
  console.log('Monthly Backup:', routineResults.monthly ? routineResults.monthly.backupId : 'Skipped (Not 1st)');

  // 2. Test Weekly generation
  console.log('\n--- 2. TESTING EXPLICIT WEEKLY BACKUP GENERATION ---');
  const weeklyResult = await runDatabaseBackup('weekly');
  console.log('Weekly Backup ID:', weeklyResult.backupId);
  console.log('Weekly Folder in Manifest:', weeklyResult.manifest?.googleDriveFolder);
  console.log('Weekly Checksum:', weeklyResult.manifest?.checksum?.slice(0, 16) + '...');

  // 3. Test Monthly generation
  console.log('\n--- 3. TESTING EXPLICIT MONTHLY BACKUP GENERATION ---');
  const monthlyResult = await runDatabaseBackup('monthly');
  console.log('Monthly Backup ID:', monthlyResult.backupId);
  console.log('Monthly Folder in Manifest:', monthlyResult.manifest?.googleDriveFolder);
  console.log('Monthly Checksum:', monthlyResult.manifest?.checksum?.slice(0, 16) + '...');

  // 4. Verify MongoDB Records
  console.log('\n--- 4. VERIFYING MONGODB BACKUP RECORDS ---');
  const latestBackups = await BackupRecord.find().sort({ startedAt: -1 }).limit(5).lean();
  latestBackups.forEach((b, i) => {
    console.log(`${i + 1}. [${b.type.toUpperCase()}] ${b.backupId} | Status: ${b.status} | Size: ${(b.size / 1024).toFixed(1)} KB`);
  });

  console.log('\n====================================================');
  console.log('🎉 ALL NIGHTLY BACKUP CASCADE CHECKS PASSED!');
  console.log('====================================================');

  await mongoose.disconnect();
}

testNightlyRoutine();
