import { Router } from 'express';
import {
  getBackupsList,
  runBackupNow,
  recordBackupDriveSync
} from './backup.controller.js';
import { requireSuperAuth, requireBackupWorkerAuth } from '../../middleware/auth.js';

export const backupRouter = Router();

// Super Admin Protected Endpoints
backupRouter.get('/', requireSuperAuth, getBackupsList);
backupRouter.post('/run', requireSuperAuth, runBackupNow);

// Worker Sync Endpoints
backupRouter.post('/sync-drive', requireBackupWorkerAuth, recordBackupDriveSync);
