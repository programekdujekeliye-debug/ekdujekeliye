import fs from 'fs';
import path from 'path';
import { BackupRecord } from '../../models/BackupRecord.js';
import { runDatabaseBackup, runNightlyBackupRoutine, ensureScheduledBackup } from '../../jobs/backup.job.js';
import { env } from '../../config/env.js';

/**
 * Idempotent ensure endpoint for Google Apps Script backup worker
 * Accepts { type: 'daily' | 'weekly' | 'monthly' }
 * Returns deterministic record, never duplicates.
 */
export const ensureBackup = async (req, res) => {
  try {
    const type = req.body.type || 'daily';
    if (!['daily', 'weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'type must be one of: daily, weekly, monthly' });
    }

    const result = await ensureScheduledBackup(type);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: `Ensure backup failed: ${err.message}` });
  }
};

/**
 * Lists all database backup records for Super Admin
 */
export const getBackupsList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '15', 10)));
    const type = req.query.type;

    const filter = {};
    if (type && type !== 'all') filter.type = type;

    const [backups, total] = await Promise.all([
      BackupRecord.find(filter)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BackupRecord.countDocuments(filter)
    ]);

    res.json({
      success: true,
      backups,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve backup list: ${err.message}` });
  }
};

/**
 * Triggers an on-demand database backup (Super Admin or Backup Worker)
 */
export const runBackupNow = async (req, res) => {
  try {
    const type = req.body.type || 'manual';
    const eventId = req.body.eventId || null;

    if (type === 'nightly') {
      const routineResults = await runNightlyBackupRoutine();
      return res.json({
        success: true,
        message: 'Nightly backup routine (Daily -> Weekly on Sun -> Monthly on 1st) executed successfully.',
        results: routineResults
      });
    }

    const result = await runDatabaseBackup(type, eventId);
    res.json({
      success: true,
      message: `Database backup (${type}) generated successfully with SHA-256 integrity verification.`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
};

/**
 * Worker downloads database snapshot .json.gz file by backupId
 * Path traversal strictly prevented via known backupId database lookup
 */
export const getBackupFile = async (req, res) => {
  try {
    const { backupId } = req.params;
    if (!backupId) {
      return res.status(400).json({ error: 'backupId is required.' });
    }

    const backup = await BackupRecord.findOne({ backupId }).lean();
    if (!backup) {
      return res.status(404).json({ error: 'Backup record not found.' });
    }

    const backupsDir = path.resolve(process.cwd(), 'backups');
    const safeFilename = path.basename(`${backup.backupId}.json.gz`);
    const filePath = path.join(backupsDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup physical file not found on disk (may have been pruned after Drive sync).' });
    }

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('X-Backup-Checksum', backup.checksum || '');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: `Failed to stream backup file: ${err.message}` });
  }
};

/**
 * Worker downloads or retrieves manifest JSON for a backup
 */
export const getBackupManifest = async (req, res) => {
  try {
    const { backupId } = req.params;
    if (!backupId) {
      return res.status(400).json({ error: 'backupId is required.' });
    }

    const backup = await BackupRecord.findOne({ backupId }).lean();
    if (!backup) {
      return res.status(404).json({ error: 'Backup record not found.' });
    }

    // Try reading local manifest file or return stored manifest
    const backupsDir = path.resolve(process.cwd(), 'backups');
    const manifestPath = path.join(backupsDir, `manifest_${backup.backupId}.json`);

    let manifestData = backup.manifest || {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (_) {}
    }

    res.json({
      success: true,
      backupId: backup.backupId,
      type: backup.type,
      checksum: backup.checksum,
      size: backup.size,
      manifest: manifestData
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch backup manifest: ${err.message}` });
  }
};

/**
 * Worker records Google Drive sync status for a backup
 * Verifies real Drive IDs, updates record, and prunes local temp file safely
 */
export const recordBackupDriveSync = async (req, res) => {
  try {
    const { backupId, driveFileId, driveManifestFileId, driveFolderId, fileSize } = req.body;
    if (!backupId || !driveFileId) {
      return res.status(400).json({ error: 'backupId and driveFileId are required.' });
    }

    // Guard against mock / test verification payloads in production
    if (!env.ALLOW_MOCK_ARCHIVE_VERIFICATION) {
      const lower = String(driveFileId).toLowerCase();
      if (
        lower.startsWith('mock') ||
        lower.startsWith('test') ||
        lower.startsWith('fake') ||
        lower.startsWith('drive_mock') ||
        lower.includes('placeholder')
      ) {
        return res.status(400).json({
          error: 'Mock Drive verification IDs are rejected in production. Real Google Apps Script Drive File ID required.'
        });
      }
    }

    const backup = await BackupRecord.findOne({ backupId });
    if (!backup) {
      return res.status(404).json({ error: 'Backup record not found.' });
    }

    backup.status = 'verified';
    backup.driveFileId = driveFileId;
    if (driveManifestFileId) backup.driveManifestFileId = driveManifestFileId;
    if (driveFolderId) backup.driveFolderId = driveFolderId;
    backup.driveVerifiedAt = new Date();
    await backup.save();

    // Safely prune temporary local backup files from Render/local disk after Google Drive verification
    try {
      const backupsDir = path.resolve(process.cwd(), 'backups');
      const gzPath = path.join(backupsDir, `${backup.backupId}.json.gz`);
      const manifestPath = path.join(backupsDir, `manifest_${backup.backupId}.json`);

      if (fs.existsSync(gzPath)) fs.unlinkSync(gzPath);
      if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
    } catch (pruneErr) {
      console.warn(`[Backup Prune Warning] Could not delete local temp files for ${backupId}: ${pruneErr.message}`);
    }

    res.json({
      success: true,
      message: 'Backup Google Drive sync verified and recorded.',
      backup: {
        backupId: backup.backupId,
        status: backup.status,
        driveFileId: backup.driveFileId,
        driveManifestFileId: backup.driveManifestFileId,
        driveFolderId: backup.driveFolderId,
        driveVerifiedAt: backup.driveVerifiedAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to record backup Drive sync: ${err.message}` });
  }
};
