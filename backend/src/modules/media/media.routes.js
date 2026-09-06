import { Router } from 'express';
import {
  createUploadSession,
  getDirectUploadUrl,
  completeUpload,
  getPrivateCouplePhoto,
  getPrivatePaymentProof,
  createMediaViewToken,
  getArchivedMediaPreview,
  downloadArchivedOriginal
} from './media.controller.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

export const mediaRouter = Router();

// 1. Hardened direct browser upload pipeline
mediaRouter.post('/upload-session', optionalAuth, createUploadSession);
mediaRouter.post('/upload-url', optionalAuth, getDirectUploadUrl);
mediaRouter.post('/upload-complete', optionalAuth, completeUpload);

// 2. Private media endpoints (Couple photos & Payment proofs)
mediaRouter.get('/:registrationId/couple-photo', optionalAuth, getPrivateCouplePhoto);
mediaRouter.get('/:registrationId/payment-proof', requireAuth, getPrivatePaymentProof);

// 3. Protected signed view token endpoint
mediaRouter.post('/:registrationId/view-token', requireAuth, createMediaViewToken);
mediaRouter.get('/:registrationId/view-token', requireAuth, createMediaViewToken);

// 4. Historical media preview and download endpoints (protected by Admin RBAC or signed HMAC token)
mediaRouter.get('/:registrationId/preview', optionalAuth, getArchivedMediaPreview);
mediaRouter.get('/:registrationId/download', optionalAuth, downloadArchivedOriginal);
