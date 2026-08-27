import { Router } from 'express';
import { createMediaViewToken } from './media.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const mediaRouter = Router();

// Protected signed view token endpoint
mediaRouter.post('/:registrationId/view-token', requireAuth, createMediaViewToken);
mediaRouter.get('/:registrationId/view-token', requireAuth, createMediaViewToken);
