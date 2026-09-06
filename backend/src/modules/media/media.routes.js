import { Router } from 'express';
import {
  createMediaViewToken,
  getArchivedMediaPreview,
  downloadArchivedOriginal
} from './media.controller.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

export const mediaRouter = Router();

// Protected signed view token endpoint
mediaRouter.post('/:registrationId/view-token', requireAuth, createMediaViewToken);
mediaRouter.get('/:registrationId/view-token', requireAuth, createMediaViewToken);

// Historical media preview and download endpoints (protected by Admin RBAC or signed HMAC token)
mediaRouter.get('/:registrationId/preview', optionalAuth, getArchivedMediaPreview);
mediaRouter.get('/:registrationId/download', optionalAuth, downloadArchivedOriginal);

