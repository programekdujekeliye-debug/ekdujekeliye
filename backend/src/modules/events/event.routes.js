import { Router } from 'express';
import {
  getPublicEvents,
  getEventBySlug,
  getEventOptions,
  getAdminEvents,
  createEvent,
  updateEvent,
  duplicateEvent,
  deleteEvent
} from './event.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const eventRouter = Router();

// Public Discovery & Lightweight Selector Endpoints
eventRouter.get('/public', getPublicEvents);
eventRouter.get('/options', getEventOptions);
eventRouter.get('/summary', getAdminEvents);
eventRouter.get('/slug/:slug', getEventBySlug);

// Admin Management Endpoints
eventRouter.get('/', getAdminEvents);
eventRouter.post('/', requireAuth, createEvent);
eventRouter.post('/:id/duplicate', requireAuth, duplicateEvent);
eventRouter.put('/:id', requireAuth, updateEvent);
eventRouter.delete('/:id', requireAuth, deleteEvent);
