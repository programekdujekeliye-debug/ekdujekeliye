import express from 'express';
import path from 'path';
import fs from 'fs';
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
import { mediaRouter } from './modules/media/media.routes.js';
import { passRouter } from './modules/passes/pass.routes.js';
import { scannerRouter } from './modules/scanner/scanner.routes.js';
import { invitationRouter } from './modules/invitations/invitation.routes.js';
import { feedbackRouter } from './modules/feedback/feedback.routes.js';

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
  dismissNotification,
  getAdminDashboardSummary,
  getSuperAdminDashboardSummary
} from './modules/admin/admin.controller.js';
import { requireAuth, requireSuperAuth, requireCronAuth } from './middleware/auth.js';
import { runPaymentReminders } from './jobs/paymentReminders.job.js';
import { getRazorpayKeyId } from './integrations/razorpay/razorpay.service.js';
import { Setting } from './models/Setting.js';
import multer from 'multer';

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

app.get('/api/config/public', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'global' }).lean();
    res.json({
      brandName: setting?.brandName || 'Ek Duje Ke Liye',
      businessCategory: setting?.businessCategory || 'Events & Programs',
      businessDescription: setting?.businessDescription || 'Ek Duje Ke Liye - A Special Program for Couples',
      supportPhone: setting?.supportPhone || '+91 82003 02328',
      supportWhatsapp: setting?.supportWhatsapp || '+91 82003 02328',
      supportEmail: setting?.supportEmail || 'privacy.ekdujekeliye@gmail.com',
      websiteEmail: setting?.websiteEmail || '',
      instagramUrl: setting?.instagramUrl || 'https://www.instagram.com/ekdujekeliye',
      facebookUrl: setting?.facebookUrl || 'https://www.facebook.com/ekdujekeliye',
      youtubeUrl: setting?.youtubeUrl || '',
      linktreeUrl: setting?.linktreeUrl || 'https://linktr.ee/ekdujekeliye',
      manishYoutubeUrl: setting?.manishYoutubeUrl || 'https://www.youtube.com/@manishvaghasiya',
      manishInstagramUrl: setting?.manishInstagramUrl || 'https://www.instagram.com/manishvaghasiya_',
      manishFacebookUrl: setting?.manishFacebookUrl || 'https://www.facebook.com/manishvaghasiya',
      manishLinkedinUrl: setting?.manishLinkedinUrl || 'https://www.linkedin.com/in/manishvaghasiya',
      manishTwitterUrl: setting?.manishTwitterUrl || 'https://twitter.com/manishvaghasiya',
      defaultCity: setting?.defaultCity || 'Surat',
      defaultCountry: setting?.defaultCountry || 'India',
      defaultCurrency: setting?.defaultCurrency || 'INR',
      defaultPrice: setting?.defaultPrice || Number(setting?.amount) || 1500,
      defaultSpeakerName: setting?.defaultSpeakerName || 'Manish Vaghasiya',
      defaultSpeakerTitle: setting?.defaultSpeakerTitle || 'Couple Relationship Counselor & Life Coach',
      defaultFooterCopy: setting?.defaultFooterCopy || '',
      razorpayKeyId: getRazorpayKeyId(),
      currency: 'INR',
      defaultAmount: setting?.defaultPrice || Number(setting?.amount) || 1500
    });
  } catch (err) {
    res.json({
      brandName: 'Ek Duje Ke Liye',
      businessCategory: 'Events & Programs',
      businessDescription: 'Ek Duje Ke Liye - A Special Program for Couples',
      supportPhone: '+91 82003 02328',
      supportWhatsapp: '+91 82003 02328',
      supportEmail: 'privacy.ekdujekeliye@gmail.com',
      razorpayKeyId: getRazorpayKeyId(),
      currency: 'INR',
      defaultAmount: 1500
    });
  }
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

// 1. Programs / Events / Options / Summary
app.use('/api/programs', eventRouter);
app.use('/api/events', eventRouter);
app.use('/api/admin/events', eventRouter);

// Operational Dashboard Direct Routes
app.get('/api/admin/dashboard', requireAuth, getAdminDashboardSummary);
app.get('/api/super-admin/dashboard', requireSuperAuth, getSuperAdminDashboardSummary);

// 2. Registrations & Inquiries
app.post('/api/submit', upload.fields([{ name: 'couplePhoto', maxCount: 1 }]), submitRegistration);
app.get('/api/submissions/status/:inquiryId', getRegistrationStatus);
app.get('/api/registrations/status/:inquiryId', getRegistrationStatus);
app.use('/api/submissions', registrationRouter);
app.use('/api/registrations', registrationRouter);

// 3. Payments & Passes
app.post('/api/payments/create-order', createOrder);
app.post('/api/payments/verify', verifyPayment);
app.get('/api/payments/status/:inquiryId', getPaymentStatus);
app.post('/api/webhooks/razorpay', handleRazorpayWebhook);
app.use('/api/payments', paymentRouter);
app.use('/api/passes', passRouter);
app.use('/api/invitations', invitationRouter);
app.use('/api/feedback', feedbackRouter);

// 4. WhatsApp Webhooks & Messaging
app.get('/webhook', handleVerification);
app.post('/webhook', handleEvents);
app.get('/api/webhook', handleVerification);
app.post('/api/webhook', handleEvents);
app.get('/api/webhooks/whatsapp', handleVerification);
app.post('/api/webhooks/whatsapp', handleEvents);
app.get('/api/whatsapp-templates/active', getActiveTemplate);
app.get('/api/whatsapp-templates', requireAuth, getTemplates);
app.post('/api/whatsapp-templates', requireAuth, createTemplate);
app.post('/api/whatsapp-templates/:id/use', requireAuth, activateTemplate);
app.use('/api/whatsapp', whatsappRouter);

// 5. System Environment Diagnostic & Settings
app.get('/api/system/environment', (req, res) => {
  res.json({
    appEnv: env.APP_ENV,
    databaseEnvironment: env.DATABASE_ENV,
    databaseName: env.DATABASE_NAME,
    razorpayMode: env.RAZORPAY_MODE.toUpperCase(),
    whatsappMode: env.WHATSAPP_MODE.toUpperCase(),
    cloudinaryEnvironment: env.CLOUDINARY_ENV.toUpperCase(),
    driveEnvironment: env.DRIVE_ENV.toUpperCase()
  });
});
app.get('/api/admin/system/resources', requireSuperAuth, getSystemResources);
app.get('/api/settings', getSettings);
app.post('/api/settings', requireSuperAuth, updateSettings);
app.get('/api/db-status', requireSuperAuth, getDbStatus);
app.get('/api/notifications', requireAuth, getNotifications);
app.post('/api/notifications/dismiss', requireAuth, dismissNotification);
app.use('/api/admin/scanner', scannerRouter);
app.use('/api/scanner', scannerRouter);
app.use('/api/admin', adminRouter);

// 6. Super Admin & Worker Protected Storage, Archive & Backup Routes
app.use('/api/internal/archive', archiveRouter);
app.use('/api/internal/backups', backupRouter);
app.use('/api/super-admin/archive', archiveRouter);
app.use('/api/admin/archive', archiveRouter);
app.use('/api/archive', archiveRouter);
app.use('/api/super-admin/backups', backupRouter);
app.use('/api/super-admin/finance', financeRouter);
app.use('/api/super-admin/system', adminRouter);
app.use('/api/finance', financeRouter);
app.use('/api/admin/media', mediaRouter);
app.use('/api/media', mediaRouter);

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
