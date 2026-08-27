import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { corsMiddleware } from './config/cors.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';

// Module Routers
import { eventRouter } from './modules/events/event.routes.js';
import { registrationRouter } from './modules/registrations/registration.routes.js';
import { paymentRouter } from './modules/payments/payment.routes.js';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes.js';
import { financeRouter } from './modules/finance/finance.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { archiveRouter } from './modules/archive/archive.routes.js';
import { backupRouter } from './modules/backup/backup.routes.js';

// Controller direct mappings for total legacy URL compatibility
import { getPublicEvents, getEventBySlug } from './modules/events/event.controller.js';
import {
  submitRegistration,
  getRegistrationStatus,
  getCouplePhotoRedirect,
  getPaymentScreenshotRedirect
} from './modules/registrations/registration.controller.js';
import { createOrder, verifyPayment, handleRazorpayWebhook, getPaymentStatus } from './modules/payments/payment.controller.js';
import { handleVerification, handleEvents, getActiveTemplate, getTemplates, createTemplate, activateTemplate } from './modules/whatsapp/whatsapp.controller.js';
import {
  getSettings,
  updateSettings,
  getDbStatus,
  getSystemResources,
  getNotifications,
  dismissNotification
} from './modules/admin/admin.controller.js';
import { requireAuth, requireSuperAuth, requireCronAuth } from './middleware/auth.js';
import { runPaymentReminders } from './jobs/paymentReminders.job.js';
import { getRazorpayKeyId } from './integrations/razorpay/razorpay.service.js';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ storage: multer.memoryStorage() });

export const app = express();

app.set('trust proxy', true);
app.use(corsMiddleware);
app.use(requestLogger);

// Capture raw body for Razorpay Webhook signature verification
app.use(express.json({
  limit: '20mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && (req.originalUrl.startsWith('/api/webhooks/razorpay') || req.originalUrl.startsWith('/api/payments/webhook'))) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Uploads static directory
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// --- System & Discovery Endpoints ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend server is running successfully.', version: '2.0.0' });
});

app.get('/api/config/public', (req, res) => {
  res.json({
    razorpayKeyId: getRazorpayKeyId(),
    currency: 'INR',
    defaultAmount: 1500
  });
});

// High-Performance Aggregated Discovery Endpoints (V2)
app.get('/api/public/home', getPublicEvents);
app.get('/api/public/events/:slug', getEventBySlug);

// Auth verification endpoint
app.get('/api/auth/verify', requireAuth, (req, res) => {
  res.json({
    role: req.user.role === 'SUPER_ADMIN' ? 'superadmin' : 'admin',
    authenticated: true
  });
});

// --- Direct CDN Media Redirects (No Media Proxying Through Render) ---
app.get('/api/submissions/:inquiryId/photo', getCouplePhotoRedirect);
app.get('/api/submissions/:inquiryId/screenshot', getPaymentScreenshotRedirect);

// --- 100% Backwards Compatible Route Mappings ---

// 1. Programs / Events
app.use('/api/programs', eventRouter);

// 2. Registrations & Inquiries
app.post('/api/submit', upload.fields([{ name: 'couplePhoto', maxCount: 1 }]), submitRegistration);
app.get('/api/submissions/status/:inquiryId', getRegistrationStatus);
app.use('/api/submissions', registrationRouter);

// 3. Payments
app.post('/api/payments/create-order', createOrder);
app.post('/api/payments/verify', verifyPayment);
app.get('/api/payments/status/:inquiryId', getPaymentStatus);
app.post('/api/webhooks/razorpay', handleRazorpayWebhook);
app.use('/api/payments', paymentRouter);

// 4. WhatsApp
app.get('/api/webhooks/whatsapp', handleVerification);
app.post('/api/webhooks/whatsapp', handleEvents);
app.get('/api/whatsapp-templates/active', getActiveTemplate);
app.get('/api/whatsapp-templates', requireAuth, getTemplates);
app.post('/api/whatsapp-templates', requireAuth, createTemplate);
app.post('/api/whatsapp-templates/:id/use', requireAuth, activateTemplate);
app.use('/api/whatsapp', whatsappRouter);

// 5. Admin, Settings & System Resource Guardrails Monitor
app.get('/api/admin/system/resources', requireSuperAuth, getSystemResources);
app.get('/api/settings', getSettings);
app.post('/api/settings', requireSuperAuth, updateSettings);
app.get('/api/db-status', requireSuperAuth, getDbStatus);
app.get('/api/notifications', requireAuth, getNotifications);
app.post('/api/notifications/dismiss', requireAuth, dismissNotification);
app.use('/api/admin', adminRouter);

// 6. Super Admin & Worker Protected Storage, Archive & Backup Routes
app.use('/api/internal/archive', archiveRouter);
app.use('/api/super-admin/archive', archiveRouter);
app.use('/api/super-admin/backups', backupRouter);
app.use('/api/super-admin/finance', financeRouter);
app.use('/api/super-admin/system', adminRouter);
app.use('/api/finance', financeRouter);

// 7. Background Jobs Trigger Endpoint
app.post('/api/jobs/payment-reminders', requireCronAuth, async (req, res) => {
  try {
    const result = await runPaymentReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run payment reminders job.' });
  }
});

// Centralized Error Handler
app.use(errorHandler);
