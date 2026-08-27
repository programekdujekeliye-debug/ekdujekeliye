import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { BackupRecord } from '../src/models/BackupRecord.js';
import { env } from '../src/config/env.js';

async function inspectBackups() {
  await mongoose.connect(env.MONGO_URI);
  const backups = await BackupRecord.find({}).sort({ createdAt: -1 }).lean();
  console.log('=== ALL DATABASE BACKUP RECORDS ===');
  console.log(`Found ${backups.length} backup record(s):`);

  const backupsDir = path.resolve(process.cwd(), 'backups');
  for (const b of backups) {
    const filePath = path.join(backupsDir, `${b.backupId}.json.gz`);
    const manifestPath = path.join(backupsDir, `manifest_${b.backupId}.json`);
    const fileExists = fs.existsSync(filePath);
    const manifestExists = fs.existsSync(manifestPath);
    console.log(`\n- Backup ID: ${b.backupId}`);
    console.log(`  Type: ${b.type}`);
    console.log(`  Status: ${b.status}`);
    console.log(`  Size: ${b.size} bytes (~${(b.size / 1024).toFixed(1)} KB)`);
    console.log(`  Checksum: ${b.checksum}`);
    console.log(`  DriveFileId: ${b.driveFileId || 'None'}`);
    console.log(`  Local File Exists: ${fileExists} (${filePath})`);
    console.log(`  Local Manifest Exists: ${manifestExists}`);
  }

  await mongoose.disconnect();
}
inspectBackups();
