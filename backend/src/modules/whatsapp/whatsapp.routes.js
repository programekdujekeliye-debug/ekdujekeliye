import { Router } from 'express';
import {
  handleVerification,
  handleEvents,
  getMetaTemplates,
  sendTestMessage,
  getWhatsappLogs,
  getRegistrationTimeline,
  getEventCommunicationDashboard,
  getEventRegistrationsCommunication,
  previewBroadcastAudience,
  createEventBroadcast,
  previewSpecificBroadcast,
  sendSpecificBroadcast,
  triggerGalleryReady,
  getPostEventStatus,
  triggerPostEventSend,
  runSchedulerWorker,
  resendMessage,
  getTemplates,
  createTemplate,
  activateTemplate,
  getConversations,
  getConversationStats,
  getConversationDetails,
  replyConversation,
  templateReplyConversation,
  addConversationNote,
  markConversationAsRead,
  assignConversation,
  updateConversationStatus,
  checkOrCreateConversationByPhone,
  syncHistoricalConversations,
  simulateInboundMessage
} from './whatsapp.controller.js';
import { requireAuth, requireSuperAuth, requireCronAuth } from '../../middleware/auth.js';

export const whatsappRouter = Router();

// Meta Webhook (GET subscription verify, POST inbound events)
whatsappRouter.get('/webhook', handleVerification);
whatsappRouter.post('/webhook', handleEvents);

// Two-Way WhatsApp Support Inbox
whatsappRouter.get('/conversations/stats', requireAuth, getConversationStats);
whatsappRouter.get('/conversations', requireAuth, getConversations);
whatsappRouter.post('/conversations/check-phone', requireAuth, checkOrCreateConversationByPhone);
whatsappRouter.post('/conversations/sync', requireAuth, syncHistoricalConversations);
whatsappRouter.post('/simulate-inbound', requireAuth, simulateInboundMessage);
whatsappRouter.get('/conversations/:conversationId', requireAuth, getConversationDetails);
whatsappRouter.post('/conversations/:conversationId/reply', requireAuth, replyConversation);
whatsappRouter.post('/conversations/:conversationId/template-reply', requireAuth, templateReplyConversation);
whatsappRouter.post('/conversations/:conversationId/notes', requireAuth, addConversationNote);
whatsappRouter.post('/conversations/:conversationId/read', requireAuth, markConversationAsRead);
whatsappRouter.patch('/conversations/:conversationId/assign', requireAuth, assignConversation);
whatsappRouter.patch('/conversations/:conversationId/status', requireAuth, updateConversationStatus);

// Meta Approved Templates & Live Test Tool
whatsappRouter.get('/meta-templates', requireAuth, getMetaTemplates);
whatsappRouter.post('/send-test', requireAuth, sendTestMessage);
whatsappRouter.get('/logs', requireAuth, getWhatsappLogs);

// Communication Timeline, Dashboard & Manual Operations
whatsappRouter.get('/timeline/:inquiryId', requireAuth, getRegistrationTimeline);
whatsappRouter.get('/dashboard/events/:eventId', requireAuth, getEventCommunicationDashboard);
whatsappRouter.get('/dashboard/events/:eventId/registrations', requireAuth, getEventRegistrationsCommunication);
whatsappRouter.post('/broadcasts/preview', requireAuth, previewBroadcastAudience);
whatsappRouter.post('/broadcasts', requireAuth, createEventBroadcast);
whatsappRouter.post('/broadcasts/specific-preview', requireAuth, previewSpecificBroadcast);
whatsappRouter.post('/broadcasts/specific-send', requireAuth, sendSpecificBroadcast);
whatsappRouter.get('/events/:eventId/post-event-status', requireAuth, getPostEventStatus);
whatsappRouter.post('/events/:eventId/post-event-send', requireAuth, triggerPostEventSend);
whatsappRouter.post('/events/:eventId/gallery-ready', requireAuth, triggerGalleryReady);
whatsappRouter.post('/resend', requireAuth, resendMessage);
whatsappRouter.post('/run-worker', requireCronAuth, runSchedulerWorker);
whatsappRouter.post('/run-worker-admin', requireAuth, runSchedulerWorker);

// Template Management (Custom DB Templates)
whatsappRouter.get('/templates', requireAuth, getTemplates);
whatsappRouter.post('/templates', requireAuth, createTemplate);
whatsappRouter.post('/templates/:id/use', requireAuth, activateTemplate);

