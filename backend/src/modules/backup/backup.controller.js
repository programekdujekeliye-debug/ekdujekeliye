import { BackupRecord } from '../../models/BackupRecord.js';
import { runDatabaseBackup } from '../../jobs/backup.job.js';

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
 * Worker records Google Drive sync status for a backup
 */
export const recordBackupDriveSync = async (req, res) => {
  try {
    const { backupId, driveFileId, driveManifestFileId } = req.body;
    if (!backupId || !driveFileId) {
      return res.status(400).json({ error: 'backupId and driveFileId are required.' });
    }

    const backup = await BackupRecord.findOneAndUpdate(
      { backupId },
      {
        $set: {
          driveFileId,
          driveManifestFileId: driveManifestFileId || null,
          status: 'verified'
        }
      },
      { new: true }
    );

    if (!backup) {
      return res.status(404).json({ error: 'Backup record not found.' });
    }

    res.json({ success: true, message: 'Backup Google Drive sync verified and recorded.', backup });
  } catch (err) {
    res.status(500).json({ error: `Failed to record backup Drive sync: ${err.message}` });
  }
};
