import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  handleOnlineScan,
  prepareOfflineEvent,
  handleOfflineSync,
  handleManualAttendance,
  getScannerStats
} from './scanner.controller.js';

export const scannerRouter = Router();

scannerRouter.post('/scan', requireAuth, handleOnlineScan);
scannerRouter.post('/prepare', requireAuth, prepareOfflineEvent);
scannerRouter.post('/sync', requireAuth, handleOfflineSync);
scannerRouter.post('/manual', requireAuth, handleManualAttendance);
scannerRouter.get('/stats', requireAuth, getScannerStats);
