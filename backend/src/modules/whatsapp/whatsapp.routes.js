import { Router } from 'express';
import {
  handleVerification,
  handleEvents,
  getTemplates,
  createTemplate,
  activateTemplate,
  getActiveTemplate
} from './whatsapp.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const whatsappRouter = Router();

// Meta Webhook (GET subscription verify, POST inbound events)
whatsappRouter.get('/webhook', handleVerification);
whatsappRouter.post('/webhook', handleEvents);

// Template Management
whatsappRouter.get('/templates', requireAuth, getTemplates);
whatsappRouter.post('/templates', requireAuth, createTemplate);
whatsappRouter.post('/templates/:id/use', requireAuth, activateTemplate);
whatsappRouter.get('/templates/active', getActiveTemplate);
