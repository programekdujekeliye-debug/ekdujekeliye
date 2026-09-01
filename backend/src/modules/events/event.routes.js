import { Router } from 'express';
import multer from 'multer';
import {
  getPublicEvents,
  getEventBySlug,
  getEventOptions,
  getAdminEvents,
  createEvent,
  updateEvent,
  duplicateEvent,
  deleteEvent,
  getEnablePaymentPreview,
  enablePaymentAndCommunications,
  uploadCardTemplate
} from './event.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

export const eventRouter = Router();

// Public Discovery & Lightweight Selector Endpoints
eventRouter.get('/public', getPublicEvents);
eventRouter.get('/options', getEventOptions);
eventRouter.get('/summary', getAdminEvents);
eventRouter.get('/slug/:slug', getEventBySlug);

// Admin Management Endpoints
eventRouter.get('/', getAdminEvents);
eventRouter.post('/', requireAuth, createEvent);
eventRouter.get('/:id/enable-payment-preview', requireAuth, getEnablePaymentPreview);
eventRouter.post('/:id/enable-payment', requireAuth, enablePaymentAndCommunications);
eventRouter.post('/:id/duplicate', requireAuth, duplicateEvent);
eventRouter.post('/:id/upload-template', requireAuth, upload.single('templateFile'), uploadCardTemplate);
eventRouter.put('/:id', requireAuth, updateEvent);
eventRouter.delete('/:id', requireAuth, deleteEvent);
