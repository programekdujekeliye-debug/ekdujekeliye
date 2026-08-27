import { Router } from 'express';
import {
  getSystemResources,
  triggerDatabaseBackup,
  getIntegrationsStatus,
  getDbStatus,
  getSettings,
  updateSettings,
  getNotifications,
  dismissNotification,
  clearAllData
} from './admin.controller.js';
import { requireAuth, requireSuperAuth } from '../../middleware/auth.js';

export const adminRouter = Router();

// System, Resources, Backups & Destructive Actions (Super Admin Only)
adminRouter.get('/system/resources', requireSuperAuth, getSystemResources);
adminRouter.post('/system/backup', requireSuperAuth, triggerDatabaseBackup);
adminRouter.get('/system/integrations', requireSuperAuth, getIntegrationsStatus);
adminRouter.get('/db-status', requireSuperAuth, getDbStatus);
adminRouter.post('/clear-all-data', requireSuperAuth, clearAllData);

// Operational Settings & Notifications
adminRouter.get('/settings', requireAuth, getSettings);
adminRouter.post('/settings', requireSuperAuth, updateSettings);
adminRouter.get('/notifications', requireAuth, getNotifications);
adminRouter.post('/notifications/dismiss', requireAuth, dismissNotification);
