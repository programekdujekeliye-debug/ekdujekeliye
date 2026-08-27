import { Router } from 'express';
import {
  getPublicEvents,
  getEventBySlug,
  getAdminEvents,
  createEvent,
  updateEvent,
  deleteEvent
} from './event.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const eventRouter = Router();

// Public Discovery Endpoints (Compatible with /api/programs and /api/public/events)
eventRouter.get('/public', getPublicEvents);
eventRouter.get('/slug/:slug', getEventBySlug);

// Admin Management Endpoints
eventRouter.get('/', getAdminEvents);
eventRouter.post('/', requireAuth, createEvent);
eventRouter.put('/:id', requireAuth, updateEvent);
eventRouter.delete('/:id', requireAuth, deleteEvent);
