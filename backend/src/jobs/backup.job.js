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
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Calculates deterministic period key in Asia/Kolkata timezone
 * - daily: YYYY-MM-DD (e.g. 2026-08-28)
 * - weekly: YYYY-Www (e.g. 2026-W35, ISO week in Asia/Kolkata)
 * - monthly: YYYY-MM (e.g. 2026-08)
 */
export const getPeriodKey = (type, date = new Date()) => {
  // Format calendar date in Asia/Kolkata timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.format(date).split('-'); // [YYYY, MM, DD]
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  if (type === 'daily') {
    return `${year}-${month}-${day}`;
  }

  if (type === 'monthly') {
    return `${year}-${month}`;
  }

  if (type === 'weekly') {
    // Canonical ISO-8601 week calculation anchored in Asia/Kolkata
    const d = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
    const dayNum = d.getUTCDay() || 7; // Monday = 1, Sunday = 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Nearest Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  return null;
};

/**
 * Executes a full database snapshot export and creates manifest + .json.gz file
 */
export const runDatabaseBackup = async (backupType = 'daily', eventId = null, options = {}) => {
  const startedAt = new Date();
  const scheduled = options.scheduled || false;
  const periodKey = options.periodKey || (scheduled ? getPeriodKey(backupType, startedAt) : null);
  const dateStr = startedAt.toISOString().split('T')[0];
  const backupId = options.backupId || (scheduled && periodKey ? `backup_${backupType}_${periodKey}_${Date.now()}` : `backup_${backupType}_${dateStr}_${Date.now()}`);

  let backupRecord = null;
  try {
    const backupsDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    logger.info(`[Backup Job] Starting ${backupType} database snapshot export (ID: ${backupId}, Scheduled: ${scheduled}, Period: ${periodKey || 'N/A'})...`);

    // Create initial tracking record
    backupRecord = await BackupRecord.create({
      backupId,
      type: backupType,
      scheduled,
      periodKey,
      eventId,
      status: 'creating',
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
      scheduled,
      periodKey,
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
      scheduled,
      periodKey,
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

/**
 * Idempotently ensures a scheduled database backup exists for the given period.
 * 
 * CASE A: No backup exists for this period -> Create exactly one
 * CASE B: Backup exists and status = 'verified' -> Return existing record (alreadyCompleted: true)
 * CASE C: Backup exists and status = 'created' / 'sync_failed' -> Return existing pending record (alreadyCompleted: false)
 * CASE D: Backup currently 'creating' / 'pending' -> Return existing record, caller waits/retries safely
 */
export const ensureScheduledBackup = async (type = 'daily') => {
  const periodKey = getPeriodKey(type, new Date());
  if (!periodKey) {
    throw new Error(`Invalid scheduled backup type: ${type}`);
  }

  // 1. Check for existing scheduled backup for this type and periodKey
  let existing = await BackupRecord.findOne({ type, periodKey, scheduled: true });

  if (existing) {
    logger.info(`[Backup Ensure] Found existing ${type} backup for period ${periodKey} (Status: ${existing.status}, ID: ${existing.backupId})`);
    return {
      alreadyCompleted: (existing.status === 'verified'),
      isNew: false,
      backupId: existing.backupId,
      status: existing.status,
      periodKey,
      type,
      manifest: existing.manifest || null,
      backupRecord: existing
    };
  }

  // 2. Not found -> Create new scheduled backup with deterministic periodKey
  try {
    const result = await runDatabaseBackup(type, null, { scheduled: true, periodKey });
    return {
      alreadyCompleted: false,
      isNew: true,
      backupId: result.backupId,
      status: result.backupRecord.status,
      periodKey,
      type,
      manifest: result.manifest,
      backupRecord: result.backupRecord
    };
  } catch (createErr) {
    // If unique index collision occurred from simultaneous race condition, fetch winner's record
    if (createErr.code === 11000) {
      logger.info(`[Backup Ensure] Concurrent creation detected for ${type} ${periodKey}. Fetching existing record...`);
      const raceExisting = await BackupRecord.findOne({ type, periodKey, scheduled: true });
      if (raceExisting) {
        return {
          alreadyCompleted: (raceExisting.status === 'verified'),
          isNew: false,
          backupId: raceExisting.backupId,
          status: raceExisting.status,
          periodKey,
          type,
          manifest: raceExisting.manifest || null,
          backupRecord: raceExisting
        };
      }
    }
    throw createErr;
  }
};

/**
 * Nightly Backup Cascade:
 * 1. Always create DAILY backup
 * 2. If Sunday (day 0 in IST) -> also create WEEKLY backup
 * 3. If 1st of month (date 1 in IST) -> also create MONTHLY backup
 */
export const runNightlyBackupRoutine = async () => {
  const now = new Date();
  
  // Calculate day-of-week and day-of-month in Asia/Kolkata timezone
  const kolkataFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric'
  });
  const parts = kolkataFormatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value; // 'Sun', 'Mon', ...
  const dayOfMonth = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  const isSunday = (weekday === 'Sun');
  const isFirstOfMonth = (dayOfMonth === 1);

  const results = {
    executedAt: now.toISOString(),
    timezone: 'Asia/Kolkata',
    isSunday,
    isFirstOfMonth,
    daily: null,
    weekly: null,
    monthly: null
  };

  logger.info('[Nightly Backup Routine] 1. Ensuring DAILY database backup...');
  results.daily = await ensureScheduledBackup('daily');

  // Check if today is Sunday
  if (isSunday) {
    logger.info('[Nightly Backup Routine] 2. Today is Sunday IST -> Ensuring WEEKLY database backup...');
    results.weekly = await ensureScheduledBackup('weekly');
  }

  // Check if today is the 1st of the month
  if (isFirstOfMonth) {
    logger.info('[Nightly Backup Routine] 3. Today is 1st of month IST -> Ensuring MONTHLY database backup...');
    results.monthly = await ensureScheduledBackup('monthly');
  }

  return results;
};

/**
 * In-process cron initialization (fallback / dev only).
 * Disabled in production by default (Google Apps Script is primary scheduler).
 */
export const initializeBackupCron = () => {
  if (!env.ENABLE_BACKEND_BACKUP_CRON) {
    logger.info('🛡️ [Backup Cron] Backend in-process backup cron is DISABLED (Google Apps Script is authoritative primary scheduler).');
    return;
  }

  logger.info('⏰ [Backup Cron] Backend in-process backup cron is ENABLED (fallback mode).');
  // Nightly backup at 23:00 (11:00 PM)
  cron.schedule('0 23 * * *', () => {
    logger.info('[Backup Cron] Running scheduled nightly database backup routine...');
    runNightlyBackupRoutine().catch(e => logger.error('[Backup Cron] Nightly backup failed:', e));
  });
};
