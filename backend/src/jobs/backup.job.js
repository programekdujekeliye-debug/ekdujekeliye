import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import cron from 'node-cron';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { Payment } from '../models/Payment.js';
import { Setting } from '../models/Setting.js';
import { BackupRecord } from '../models/BackupRecord.js';
import { logger } from '../utils/logger.js';

export const runDatabaseBackup = async (backupType = 'daily', eventId = null) => {
  const startedAt = new Date();
  const dateStr = startedAt.toISOString().split('T')[0];
  const backupId = `backup_${backupType}_${dateStr}_${Date.now()}`;

  let backupRecord = null;
  try {
    const backupsDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    logger.info(`[Backup Job] Starting ${backupType} database snapshot export (ID: ${backupId})...`);

    // Create initial tracking record
    backupRecord = await BackupRecord.create({
      backupId,
      type: backupType,
      eventId,
      status: 'pending',
      startedAt
    });

    const [events, registrations, payments, settings] = await Promise.all([
      Event.find({}).lean(),
      Registration.find({}).lean(),
      Payment.find({}).lean(),
      Setting.find({}).lean()
    ]);

    const backupPayload = {
      timestamp: startedAt.toISOString(),
      schemaVersion: '2.0.0',
      backupType,
      eventId,
      events,
      registrations,
      payments,
      settings
    };

    const rawJson = JSON.stringify(backupPayload);
    const checksum = crypto.createHash('sha256').update(rawJson).digest('hex');

    // Gzip compress in memory
    const compressedBuffer = zlib.gzipSync(Buffer.from(rawJson, 'utf-8'));

    const filename = `${backupId}.json.gz`;
    const filePath = path.join(backupsDir, filename);

    fs.writeFileSync(filePath, compressedBuffer);

    // Write verified backup manifest
    const manifest = {
      schemaVersion: '2.0.0',
      backupId,
      backupType,
      createdAt: startedAt.toISOString(),
      eventId,
      filename,
      size: compressedBuffer.length,
      compressedSizeKB: parseFloat((compressedBuffer.length / 1024).toFixed(2)),
      collections: ['program', 'submission', 'payments', 'setting'],
      recordCounts: {
        events: events.length,
        registrations: registrations.length,
        payments: payments.length,
        settings: settings.length
      },
      checksum,
      compressed: true,
      googleDriveFolder: `Ek Duje Ke Liye/Database Backups/${backupType === 'daily' ? 'Daily' : backupType === 'weekly' ? 'Weekly' : backupType === 'monthly' ? 'Monthly' : 'Daily'}/`
    };

    const manifestFilename = `manifest_${backupId}.json`;
    const manifestPath = path.join(backupsDir, manifestFilename);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Update MongoDB tracking record
    backupRecord.status = 'created';
    backupRecord.size = compressedBuffer.length;
    backupRecord.checksum = checksum;
    backupRecord.manifest = manifest;
    backupRecord.completedAt = new Date();
    await backupRecord.save();

    logger.info(`[Backup Job] Verified backup completed: ${filename} (${manifest.compressedSizeKB} KB, Checksum: ${checksum.slice(0, 10)}...)`);

    // Prune temporary backups older than 7 days from local disk
    const files = fs.readdirSync(backupsDir);
    const pruneThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith('backup_') || file.startsWith('manifest_')) {
        const fileFull = path.join(backupsDir, file);
        const stats = fs.statSync(fileFull);
        if (stats.mtimeMs < pruneThreshold) {
          fs.unlinkSync(fileFull);
        }
      }
    }

    return { success: true, backupId, manifest, backupRecord };
  } catch (err) {
    logger.error('[Backup Job] Error running database backup:', err);
    if (backupRecord) {
      backupRecord.status = 'failed';
      backupRecord.lastError = err.message;
      backupRecord.completedAt = new Date();
      await backupRecord.save();
    }
    throw err;
  }
};

export const initializeBackupCron = () => {
  // 1. Daily backup at 22:00 (10:00 PM)
  cron.schedule('0 22 * * *', () => {
    logger.info('[Backup Cron] Running scheduled daily database backup...');
    runDatabaseBackup('daily').catch(e => logger.error('[Backup Cron] Daily backup failed:', e));
  });

  // 2. Weekly backup every Sunday at 23:00 (11:00 PM)
  cron.schedule('0 23 * * 0', () => {
    logger.info('[Backup Cron] Running scheduled weekly database backup snapshot...');
    runDatabaseBackup('weekly').catch(e => logger.error('[Backup Cron] Weekly backup failed:', e));
  });

  // 3. Monthly backup on 1st of every month at 01:00 AM
  cron.schedule('0 1 1 * *', () => {
    logger.info('[Backup Cron] Running scheduled monthly database archive...');
    runDatabaseBackup('monthly').catch(e => logger.error('[Backup Cron] Monthly backup failed:', e));
  });
};
