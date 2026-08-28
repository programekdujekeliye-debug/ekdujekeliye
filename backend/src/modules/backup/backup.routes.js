import { Router } from 'express';
import {
  getBackupsList,
  runBackupNow,
  ensureBackup,
  getBackupFile,
  getBackupManifest,
  recordBackupDriveSync
} from './backup.controller.js';
import { requireSuperAuth, requireBackupWorkerAuth } from '../../middleware/auth.js';

export const backupRouter = Router();

// Super Admin Protected Endpoints
backupRouter.get('/', requireSuperAuth, getBackupsList);
backupRouter.post('/run', requireSuperAuth, runBackupNow);

// Worker Sync & Download Endpoints (Protected by BACKUP_WORKER_SECRET)
backupRouter.post('/ensure', requireBackupWorkerAuth, ensureBackup);
backupRouter.get('/:backupId/file', requireBackupWorkerAuth, getBackupFile);
backupRouter.get('/:backupId/manifest', requireBackupWorkerAuth, getBackupManifest);
backupRouter.post('/sync-drive', requireBackupWorkerAuth, recordBackupDriveSync);
backupRouter.post('/verify-sync', requireBackupWorkerAuth, recordBackupDriveSync);
