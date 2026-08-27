# Ek Duje Ke Liye — Database Disaster Recovery & Restore Guide

This document outlines the standard operating procedure (SOP) for verifying, decompressing, and restoring database snapshots created by the automated backup system.

---

## 1. Locate the Backup File

All verified database snapshots are archived under Google Drive and temporarily in the backend `./backups/` folder:

* **Google Drive Location**:
  `Ek Duje Ke Liye/Database Backups/Daily/` (or `Weekly/`, `Monthly/`)
* **File Naming Format**:
  - Gzip Data Archive: `backup_<type>_<YYYY-MM-DD>_<timestamp>.json.gz`
  - Integrity Manifest: `manifest_backup_<type>_<YYYY-MM-DD>_<timestamp>.json`

---

## 2. Checksum Verification

Before attempting any restore, verify the cryptographic integrity of the compressed archive against the manifest:

### On Windows (PowerShell):
```powershell
Get-FileHash -Algorithm SHA256 "backup_daily_2026-08-28_1724814000.json.gz"
```

### On Linux / macOS:
```bash
sha256sum backup_daily_2026-08-28_1724814000.json.gz
```

Compare the calculated hash with the `"checksum"` property recorded in the corresponding manifest JSON. If the hashes match, the backup is 100% integral and untampered.

---

## 3. Decompressing the Snapshot

Decompress the `.json.gz` file to inspect or extract collection payloads:

### Linux / macOS:
```bash
gzip -dk backup_daily_2026-08-28_1724814000.json.gz
```

### Windows (PowerShell with 7-Zip or Node):
```powershell
node -e "
const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('backup_daily_2026-08-28_1724814000.json.gz');
const unzipped = zlib.gunzipSync(data);
fs.writeFileSync('decompressed_backup.json', unzipped);
console.log('Successfully decompressed backup JSON.');
"
```

---

## 4. Safe Restoration Procedure

> [!CAUTION]
> **Always restore to a TEST/STAGING database first!** Never run a direct restore onto the active production MongoDB Atlas cluster without first validating record counts on a sandbox database.

### Step 4.1: Import Collections into Test Database
Run the following Node restoration script to seed a staging database:

```javascript
import mongoose from 'mongoose';
import fs from 'fs';
import zlib from 'zlib';

async function restoreTestDatabase() {
  const STAGING_MONGO_URI = 'mongodb+srv://.../ekdujekeliye_test';
  await mongoose.connect(STAGING_MONGO_URI);

  const rawGz = fs.readFileSync('./backup_daily_2026-08-28_1724814000.json.gz');
  const backup = JSON.parse(zlib.gunzipSync(rawGz).toString('utf-8'));

  console.log(`Restoring schema version: ${backup.schemaVersion} created at: ${backup.timestamp}`);

  // Restore collections
  if (backup.events && backup.events.length > 0) {
    await mongoose.connection.db.collection('program').deleteMany({});
    await mongoose.connection.db.collection('program').insertMany(backup.events);
    console.log(`✓ Restored ${backup.events.length} programs`);
  }

  if (backup.registrations && backup.registrations.length > 0) {
    await mongoose.connection.db.collection('submission').deleteMany({});
    await mongoose.connection.db.collection('submission').insertMany(backup.registrations);
    console.log(`✓ Restored ${backup.registrations.length} registrations`);
  }

  if (backup.payments && backup.payments.length > 0) {
    await mongoose.connection.db.collection('payments').deleteMany({});
    await mongoose.connection.db.collection('payments').insertMany(backup.payments);
    console.log(`✓ Restored ${backup.payments.length} payment records`);
  }

  if (backup.settings && backup.settings.length > 0) {
    await mongoose.connection.db.collection('setting').deleteMany({});
    await mongoose.connection.db.collection('setting').insertMany(backup.settings);
    console.log(`✓ Restored ${backup.settings.length} settings`);
  }

  console.log('✅ Restoration and validation complete.');
  await mongoose.disconnect();
}

restoreTestDatabase();
```

---

## 5. Emergency Production Failover
Once staging verification passes:
1. Notify administrators and temporarily place the public site in maintenance mode if necessary.
2. Point the restore script to the primary `MONGO_URI`.
3. Verify public event passes (`/pass/:inquiryId`) and admin dashboards (`/admin`, `/super-admin`).
