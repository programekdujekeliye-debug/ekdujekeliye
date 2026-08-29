import { Router } from 'express';
import {
  handleVerification,
  handleEvents,
  getMetaTemplates,
  sendTestMessage,
  getWhatsappLogs,
  getRegistrationTimeline,
  getEventCommunicationDashboard,
  runSchedulerWorker,
  resendMessage,
  getTemplates,
  createTemplate,
  activateTemplate
} from './whatsapp.controller.js';
import { requireAuth, requireSuperAuth, requireCronAuth } from '../../middleware/auth.js';

export const whatsappRouter = Router();

// Meta Webhook (GET subscription verify, POST inbound events)
whatsappRouter.get('/webhook', handleVerification);
whatsappRouter.post('/webhook', handleEvents);

// Meta Approved Templates & Live Test Tool
whatsappRouter.get('/meta-templates', requireAuth, getMetaTemplates);
whatsappRouter.post('/send-test', requireAuth, sendTestMessage);
whatsappRouter.get('/logs', requireAuth, getWhatsappLogs);

// Communication Timeline, Dashboard & Manual Operations
whatsappRouter.get('/timeline/:inquiryId', requireAuth, getRegistrationTimeline);
whatsappRouter.get('/dashboard/events/:eventId', requireAuth, getEventCommunicationDashboard);
whatsappRouter.post('/resend', requireAuth, resendMessage);
whatsappRouter.post('/run-worker', requireCronAuth, runSchedulerWorker);
whatsappRouter.post('/run-worker-admin', requireSuperAuth, runSchedulerWorker);

// Template Management (Custom DB Templates)
whatsappRouter.get('/templates', requireAuth, getTemplates);
whatsappRouter.post('/templates', requireAuth, createTemplate);
whatsappRouter.post('/templates/:id/use', requireAuth, activateTemplate);
