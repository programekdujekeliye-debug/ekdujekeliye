import { Router } from 'express';
import {
  handleVerification,
  handleEvents,
  getMetaTemplates,
  sendTestMessage,
  getWhatsappLogs,
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

// Meta Approved Templates & Live Test Tool
whatsappRouter.get('/meta-templates', requireAuth, getMetaTemplates);
whatsappRouter.post('/send-test', requireAuth, sendTestMessage);
whatsappRouter.get('/logs', requireAuth, getWhatsappLogs);

// Template Management (Custom DB Templates)
whatsappRouter.get('/templates', requireAuth, getTemplates);
whatsappRouter.post('/templates', requireAuth, createTemplate);
whatsappRouter.post('/templates/:id/use', requireAuth, activateTemplate);
whatsappRouter.get('/templates/active', getActiveTemplate);
