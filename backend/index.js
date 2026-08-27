// Load environment variables from local .env if available
import fs from 'fs';
import path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) { }

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import cron from 'node-cron';
import { verifyWebhook, handleWebhookEvent } from './services/whatsappWebhook.js';
import {
  createRazorpayOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  fetchPayment,
  fetchOrder,
  getRazorpayKeyId
} from './services/razorpay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary with safe environment variable references
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'rh3wmfta',
  api_key: process.env.CLOUDINARY_API_KEY || '733288215373621',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'dPBA6hRfCtO2gx-jZ6r1Bo98Hiw'
});

const uploadToCloudinary = async (base64Data, folder = 'ekdujekeliye') => {
  if (!base64Data) return null;
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return base64Data;
  }
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: folder,
      resource_type: 'auto'
    });
    return result.secure_url;
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    throw err;
  }
};

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins dynamically to support credentials: true
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature', 'X-Razorpay-Event-Id'],
  credentials: true
}));

// Capture raw body for Razorpay Webhook signature verification without breaking global JSON parser
app.use(express.json({
  limit: '20mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/webhooks/razorpay')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically with CORS headers enabled
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}));

// Setup Multer for memory storage (avoids ephemeral disk deletion on Render)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper to generate SEO-friendly slug
const generateEventSlug = (name, city, date) => {
  const base = `${city || name || 'event'}-${date || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `event-${Date.now()}`;
};

// MongoDB Connection
const MONGO_URI = (process.env.MONGO_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority').trim();
mongoose.set('autoIndex', false); // Disable auto-indexing to prevent query buffering hangs on startup/restarts
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB database.');
    setImmediate(async () => {
      try {
        await mongoose.model('Submission').ensureIndexes();
        await mongoose.model('Program').ensureIndexes();
        await mongoose.model('WebhookEvent').ensureIndexes();
        console.log('Database indexes synchronized successfully.');

        // Migration: Assign sequenceNumber & slug to programs that don't have it
        const ProgramModel = mongoose.model('Program');
        const allPrograms = await ProgramModel.find({});
        for (const prog of allPrograms) {
          let updated = false;
          if (!prog.sequenceNumber) {
            const maxProg = await ProgramModel.findOne({ sequenceNumber: { $exists: true } }).sort({ sequenceNumber: -1 });
            prog.sequenceNumber = maxProg && maxProg.sequenceNumber ? maxProg.sequenceNumber + 1 : 1;
            updated = true;
          }
          if (!prog.slug) {
            prog.slug = generateEventSlug(prog.name, prog.city, prog.date);
            updated = true;
          }
          if (updated) {
            await prog.save();
            console.log(`[Migration] Updated program ${prog.name} (Seq: ${prog.sequenceNumber}, Slug: ${prog.slug})`);
          }
        }
        console.log('Program metadata synchronization completed.');
      } catch (err) {
        console.error('Error in index sync or program migration:', err);
      }
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Database Schemas & Models
const ProgramSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sequenceNumber: { type: Number },
  name: { type: String, required: true },
  slug: { type: String, unique: true, sparse: true, index: true },
  city: { type: String, default: '' },
  venue: { type: String, default: '' },
  mapUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  heroImage: { type: String, default: '' },
  price: { type: Number, default: 1500 },
  status: {
    type: String,
    enum: ['upcoming', 'few_seats', 'housefull', 'registration_closed', 'completed', 'date_tba'],
    default: 'upcoming'
  },
  featured: { type: Boolean, default: false },
  registrationMode: { type: String, enum: ['internal', 'external'], default: 'internal' },
  externalRegistrationUrl: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  date: { type: String, required: true },
  time: { type: String, default: "8:30 PM" },
  capacity: { type: Number, required: true },
  bookingsCount: { type: Number, default: 0 },
  isDateFinal: { type: Boolean, default: true },
  cardTemplate: { type: String },
  heartX: { type: Number, default: 144 },
  heartY: { type: Number, default: 112 },
  heartWidth: { type: Number, default: 288 },
  heartHeight: { type: Number, default: 260 },
  photoZoom: { type: Number, default: 1.0 },
  photoOffsetY: { type: Number, default: 0 },
  photoLink: { type: String, default: "" },
  isInquiryClosed: { type: Boolean, default: false }
}, { collection: 'program' });
const Program = mongoose.model('Program', ProgramSchema);

const SubmissionSchema = new mongoose.Schema({
  inquiryId: { type: String, required: true, unique: true },
  husbandName: { type: String, required: true },
  wifeName: { type: String, required: true },
  surname: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  programId: { type: String, required: true },
  programName: { type: String, required: true },
  programDate: { type: String, required: true },
  programTime: { type: String, default: "8:30 PM" },
  couplePhoto: { type: String, required: true },
  paymentScreenshot: { type: String },
  payeeNameFromReceipt: { type: String, default: 'Not detected' },
  status: { type: String, default: 'pending' },
  rejectionReason: { type: String, default: '' },
  refundReason: { type: String, default: '' },
  attendance: { type: String, enum: ['unmarked', 'present', 'absent'], default: 'unmarked' },
  isDeleted: { type: Boolean, default: false },
  photoZoom: { type: Number, default: 1.0 },
  photoOffsetY: { type: Number, default: 0 },
  oldInquiryId: { type: String },
  payment: {
    provider: { type: String, enum: ['razorpay', 'manual', 'legacy_upi', null], default: null },
    status: {
      type: String,
      enum: ['not_required', 'pending', 'created', 'authorized', 'captured', 'failed', 'expired', 'refunded'],
      default: 'pending'
    },
    amount: { type: Number },
    currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },
    createdAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    failedAt: { type: Date },
    refundedAt: { type: Date },
    attempts: { type: Number, default: 0 }
  },
  reservationExpiresAt: { type: Date, index: true },
  customerToken: { type: String },
  paymentReminder: {
    count: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
    nextReminderAt: { type: Date, default: null }
  },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'submission' });
SubmissionSchema.index({ createdAt: -1 });
SubmissionSchema.index({ programId: 1, status: 1, isDeleted: 1 });
SubmissionSchema.index({ phoneNumber: 1, status: 1 });
SubmissionSchema.index({ phoneNumber: 1, programId: 1, status: 1 });

const Submission = mongoose.model('Submission', SubmissionSchema);

// Webhook Idempotency Collection
const WebhookEventSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  eventId: { type: String, required: true },
  eventType: { type: String },
  processedAt: { type: Date, default: Date.now },
  payloadSummary: { type: mongoose.Schema.Types.Mixed }
}, { collection: 'webhook_events' });
WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
const WebhookEvent = mongoose.model('WebhookEvent', WebhookEventSchema);

async function getProgramBookingsCount(programId) {
  if (!programId) return 0;
  const count = await Submission.countDocuments({
    programId,
    status: { $in: ['approved', 'pending', 'rejected'] },
    isDeleted: { $ne: true }
  });
  return count * 2;
}

async function updateProgramBookingsCount(programId) {
  if (!programId) return 0;
  const program = await Program.findOne({ id: programId });
  if (program) {
    const activeCount = await getProgramBookingsCount(programId);
    program.bookingsCount = activeCount;
    await program.save();
    return activeCount;
  }
  return 0;
}

const SettingSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  upiId: { type: String, default: 'payee@upi' },
  upiIds: { type: [String], default: ['payee@upi'] },
  activeUpiIndex: { type: Number, default: 0 },
  upiBookingsCount: { type: Number, default: 0 },
  upiLimit: { type: Number, default: 50 },
  payeeName: { type: String, default: 'Couple Pass' },
  amount: { type: String, default: '1500' }
}, { collection: 'setting' });
const Setting = mongoose.model('Setting', SettingSchema);

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'info' }, // 'info', 'warning', 'error'
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'notifications' });
const Notification = mongoose.model('Notification', NotificationSchema);

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 999 }
}, { collection: 'counter' });
const Counter = mongoose.model('Counter', CounterSchema);

const WhatsappTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['pass_delivery', 'payment_request', 'photo_delivery'], default: 'pass_delivery' },
  isActive: { type: Boolean, default: false }
}, { collection: 'whatsapp_template' });
const WhatsappTemplate = mongoose.model('WhatsappTemplate', WhatsappTemplateSchema);

const getNextInquiryNumber = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'inquiryNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

const getNextInvitedNumber = async () => {
  const existing = await Counter.findOne({ name: 'invitedNumber' });
  if (!existing) {
    await Counter.create({ name: 'invitedNumber', seq: 0 });
  }
  const counter = await Counter.findOneAndUpdate(
    { name: 'invitedNumber' },
    { $inc: { seq: 1 } },
    { new: true }
  );
  return counter.seq;
};

// Initialize Settings
const initSettings = async () => {
  try {
    const existing = await Setting.findOne({ key: 'main' });
    if (!existing) {
      await Setting.create({
        key: 'main',
        upiId: 'payee@upi',
        upiIds: ['payee@upi'],
        activeUpiIndex: 0,
        upiBookingsCount: 0,
        upiLimit: 50,
        payeeName: 'Couple Pass',
        amount: '1500'
      });
    } else {
      let updated = false;
      if (existing.upiIds === undefined || existing.upiIds.length === 0) {
        existing.upiIds = [existing.upiId || 'payee@upi'];
        updated = true;
      }
      if (existing.activeUpiIndex === undefined) {
        existing.activeUpiIndex = 0;
        updated = true;
      }
      if (existing.upiBookingsCount === undefined) {
        existing.upiBookingsCount = 0;
        updated = true;
      }
      if (existing.upiLimit === undefined) {
        existing.upiLimit = 50;
        updated = true;
      }
      if (updated) {
        await existing.save();
      }
    }
  } catch (err) {
    console.error('Error initializing settings:', err);
  }
};
initSettings();

// Initialize WhatsApp Templates
const initWhatsappTemplates = async () => {
  try {
    const passDeliveryExists = await WhatsappTemplate.findOne({ type: 'pass_delivery' });
    if (!passDeliveryExists) {
      await WhatsappTemplate.create({
        name: 'Default Pass Delivery',
        text: 'Hello! Your payment has been verified. You can view and download your pass here: {passUrl}',
        type: 'pass_delivery',
        isActive: true
      });
      console.log('Default Pass Delivery WhatsApp template initialized.');
    }
    const paymentRequestExists = await WhatsappTemplate.findOne({ type: 'payment_request' });
    if (!paymentRequestExists) {
      await WhatsappTemplate.create({
        name: 'Default Payment Verification Request',
        text: 'Hello! I have registered for the {programName}. My Inquiry ID is {inquiryId}. My phone number is {phoneNumber}. Please verify my payment screenshot.',
        type: 'payment_request',
        isActive: true
      });
      console.log('Default Payment Verification Request WhatsApp template initialized.');
    }
    const photoDeliveryExists = await WhatsappTemplate.findOne({ type: 'photo_delivery' });
    if (!photoDeliveryExists) {
      await WhatsappTemplate.create({
        name: 'Default Photo Delivery',
        text: 'નમસ્તે {husbandName} & {wifeName}, તમારા પ્રોગ્રામ ({programName}) ના સુંદર ફોટાઓ જોવા માટે નીચેની લિંક પર ક્લિક કરો:\n\nફોટો લિંક: {photoLink}\n\nઆભાર!',
        type: 'photo_delivery',
        isActive: true
      });
      console.log('Default Photo Delivery WhatsApp template initialized.');
    }
  } catch (err) {
    console.error('Failed to initialize WhatsApp templates:', err);
  }
};
initWhatsappTemplates();

// Security / Authentication Configurations
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Manas@1177';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Manish@1177';

const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader === ADMIN_PASSWORD || authHeader === SUPER_ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Invalid password.' });
  }
};

const requireSuperAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader === SUPER_ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Super Admin password required.' });
  }
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running successfully.' });
});

// WhatsApp Cloud API Webhook Endpoints
app.get('/api/webhooks/whatsapp', verifyWebhook);
app.post('/api/webhooks/whatsapp', handleWebhookEvent);

// Public Configuration (Safe non-sensitive client identifiers)
app.get('/api/config/public', (req, res) => {
  res.json({
    razorpayKeyId: getRazorpayKeyId(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Downstream notification hook invoked when payment is finalized and captured
async function onRegistrationPaid(submission) {
  try {
    console.log(`[Payment Finalizer] Downstream hook executed for inquiry: ${submission.inquiryId} | Phone: ${submission.phoneNumber}`);
    // Future WhatsApp Cloud API automated pass delivery / webhook integration hook
  } catch (err) {
    console.error(`[Payment Finalizer] Error in onRegistrationPaid hook for ${submission?.inquiryId}:`, err);
  }
}

// Single Idempotent Payment Finalizer for Razorpay Verification & Webhooks
async function finalizeCapturedPayment({ inquiryId, paymentId, orderId, provider = 'razorpay', signature = '' }) {
  if (!inquiryId) {
    throw new Error('Inquiry ID is required for payment finalization.');
  }

  // 1. Check existing state
  const existing = await Submission.findOne({ inquiryId });
  if (!existing) {
    throw new Error(`Submission not found for Inquiry ID: ${inquiryId}`);
  }

  if (existing.payment && existing.payment.status === 'captured') {
    return { success: true, alreadyFinalized: true, submission: existing };
  }

  // 2. Atomically update status to approved and payment.status to captured
  const updated = await Submission.findOneAndUpdate(
    { inquiryId, 'payment.status': { $ne: 'captured' } },
    {
      $set: {
        status: 'approved',
        'payment.provider': provider,
        'payment.status': 'captured',
        'payment.razorpayPaymentId': paymentId || existing?.payment?.razorpayPaymentId,
        'payment.razorpayOrderId': orderId || existing?.payment?.razorpayOrderId,
        'payment.razorpaySignature': signature || existing?.payment?.razorpaySignature,
        'payment.paidAt': new Date()
      }
    },
    { new: true }
  );

  if (updated) {
    await updateProgramBookingsCount(updated.programId);
    onRegistrationPaid(updated).catch(err => console.error('Error in onRegistrationPaid hook:', err));
    return { success: true, alreadyFinalized: false, submission: updated };
  }

  // Fallback if atomic update matched 0 (e.g. concurrent winner)
  const current = await Submission.findOne({ inquiryId });
  return { success: true, alreadyFinalized: true, submission: current };
}

// Create Razorpay Order
app.post('/api/payments/create-order', async (req, res) => {
  try {
    const { inquiryId, customerToken } = req.body;

    if (!inquiryId) {
      return res.status(400).json({ error: 'Inquiry ID is required.' });
    }

    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    // Verify customer token if provided
    if (customerToken && submission.customerToken && submission.customerToken !== customerToken) {
      return res.status(403).json({ error: 'Unauthorized access to registration order.' });
    }

    if (submission.payment && submission.payment.status === 'captured') {
      return res.status(400).json({
        error: 'Payment has already been completed for this registration.',
        alreadyPaid: true,
        inquiryId: submission.inquiryId
      });
    }

    const program = await Program.findOne({ id: submission.programId });
    if (!program) {
      return res.status(404).json({ error: 'Associated event program not found.' });
    }

    // Recheck capacity
    if (program.status === 'housefull' || program.status === 'registration_closed') {
      return res.status(400).json({ error: 'Registration for this event is currently closed or housefull.' });
    }

    const activeBookings = await getProgramBookingsCount(program.id);
    if (program.isDateFinal !== false && (activeBookings + 2 > program.capacity) && submission.status !== 'approved') {
      return res.status(400).json({ error: 'This event slot is now completely sold out.' });
    }

    // Determine price authoritatively from Program or Setting
    let orderAmount = program.price || 1500;
    if (orderAmount <= 0) {
      const setting = await Setting.findOne({ key: 'main' });
      orderAmount = setting && setting.amount ? parseFloat(setting.amount) : 1500;
    }

    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder({
      inquiryId: submission.inquiryId,
      amount: orderAmount,
      currency: 'INR',
      notes: {
        inquiryId: submission.inquiryId,
        programId: program.id,
        city: program.city || ''
      }
    });

    // Update submission payment status
    submission.payment.provider = 'razorpay';
    submission.payment.status = 'created';
    submission.payment.amount = orderAmount;
    submission.payment.razorpayOrderId = razorpayOrder.id;
    submission.payment.attempts = (submission.payment.attempts || 0) + 1;
    await submission.save();

    res.json({
      success: true,
      keyId: getRazorpayKeyId(),
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      inquiryId: submission.inquiryId,
      programName: program.name,
      customerName: `${submission.husbandName} & ${submission.wifeName} ${submission.surname}`,
      phoneNumber: submission.phoneNumber
    });
  } catch (err) {
    console.error('[Razorpay Order Creation Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to initialize payment order.' });
  }
});

// Verify Checkout Signature
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { inquiryId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!inquiryId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment verification parameters.' });
    }

    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    // Validate stored order ID against received order ID
    if (submission.payment?.razorpayOrderId && submission.payment.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Order ID mismatch between registration and payment response.' });
    }

    // Verify HMAC-SHA256 signature
    const isValid = verifyCheckoutSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValid) {
      console.warn(`[Payment Verification Failed] Invalid signature for inquiry: ${inquiryId}`);
      if (submission.payment) {
        submission.payment.status = 'failed';
        submission.payment.failedAt = new Date();
        await submission.save();
      }
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    // Idempotent finalization
    const finalizeResult = await finalizeCapturedPayment({
      inquiryId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      provider: 'razorpay',
      signature: razorpay_signature
    });

    res.json({
      success: true,
      inquiryId,
      status: 'approved',
      paymentStatus: 'captured',
      passUrl: `/pass/${inquiryId}`
    });
  } catch (err) {
    console.error('[Payment Verification Error]:', err);
    res.status(500).json({ error: 'Server error verifying payment.' });
  }
});

// Authoritative Razorpay Webhook Handler
app.post('/api/webhooks/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).send('Missing webhook signature');
    }

    const isValid = verifyWebhookSignature({
      rawBody: req.rawBody,
      signature
    });

    if (!isValid) {
      console.warn('[Razorpay Webhook] Invalid webhook signature received.');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const eventId = req.headers['x-razorpay-event-id'] || event.event_id || `${event.event}_${Date.now()}`;
    const eventType = event.event;

    // Idempotency check: store eventId
    try {
      await WebhookEvent.create({
        provider: 'razorpay',
        eventId,
        eventType,
        processedAt: new Date(),
        payloadSummary: {
          event: eventType,
          paymentId: event.payload?.payment?.entity?.id,
          orderId: event.payload?.payment?.entity?.order_id
        }
      });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        console.log(`[Razorpay Webhook] Duplicate event ignored: ${eventId}`);
        return res.status(200).json({ status: 'duplicate_ignored' });
      }
      console.error('[Razorpay Webhook] Error recording webhook event:', dupErr);
    }

    // Handle payment events
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity || {};
      const inquiryId = paymentEntity.notes?.inquiryId || paymentEntity.receipt;
      const paymentId = paymentEntity.id;
      const orderId = paymentEntity.order_id;

      if (inquiryId) {
        await finalizeCapturedPayment({
          inquiryId,
          paymentId,
          orderId,
          provider: 'razorpay'
        });
        console.log(`[Razorpay Webhook] Payment captured & approved for ${inquiryId} (Payment ID: ${paymentId})`);
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity || {};
      const inquiryId = paymentEntity.notes?.inquiryId || paymentEntity.receipt;
      if (inquiryId) {
        await Submission.updateOne(
          { inquiryId, 'payment.status': { $ne: 'captured' } },
          {
            $set: {
              'payment.status': 'failed',
              'payment.failedAt': new Date(),
              'payment.razorpayPaymentId': paymentEntity.id
            }
          }
        );
        console.log(`[Razorpay Webhook] Payment failed recorded for ${inquiryId}`);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[Razorpay Webhook Error]:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

// Safe Public Payment & Registration Status Endpoint
app.get('/api/payments/status/:inquiryId', async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const submission = await Submission.findOne({ inquiryId }, {
      inquiryId: 1,
      status: 1,
      husbandName: 1,
      wifeName: 1,
      surname: 1,
      programId: 1,
      programName: 1,
      programDate: 1,
      programTime: 1,
      payment: 1,
      createdAt: 1
    });

    if (!submission) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    res.json({
      inquiryId: submission.inquiryId,
      registrationStatus: submission.status,
      paymentStatus: submission.payment?.status || (submission.status === 'approved' ? 'captured' : 'pending'),
      paymentProvider: submission.payment?.provider || 'razorpay',
      amount: submission.payment?.amount || 1500,
      price: submission.payment?.amount || 1500,
      paidAt: submission.payment?.paidAt || null,
      passAvailable: submission.status === 'approved',
      coupleName: `${submission.husbandName} & ${submission.wifeName} ${submission.surname}`,
      programName: submission.programName,
      programDate: submission.programDate
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve payment status.' });
  }
});

// Get program by SEO slug
app.get('/api/programs/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const program = await Program.findOne({ slug: slug.toLowerCase() });
    if (!program) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const obj = program.toObject();
    obj.cardTemplate = program.cardTemplate ? `${protocol}://${host}/api/programs/${program.id}/template` : null;

    // Dynamic available seats calculation
    const activeBookings = await getProgramBookingsCount(program.id);
    obj.activeBookings = activeBookings;
    obj.availableSeats = Math.max(0, program.capacity - activeBookings);

    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching event details.' });
  }
});

// Payment Reminders Worker Endpoint (Protected by CRON_SECRET)
app.post('/api/jobs/payment-reminders', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const expectedSecret = process.env.CRON_SECRET || 'EkDujeCron_Secret_2026';
    if (authHeader !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ error: 'Unauthorized cron request.' });
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const pendingSubmissions = await Submission.find({
      status: 'pending',
      'payment.status': { $in: ['pending', 'created', 'failed'] },
      createdAt: { $lte: thirtyMinutesAgo },
      'paymentReminder.count': { $lt: 2 }
    }).limit(20);

    let processedCount = 0;
    for (const sub of pendingSubmissions) {
      // Re-verify payment is still pending immediately before acting
      const current = await Submission.findOne({ inquiryId: sub.inquiryId });
      if (current && current.payment?.status === 'captured') continue;

      sub.paymentReminder.count = (sub.paymentReminder.count || 0) + 1;
      sub.paymentReminder.lastSentAt = new Date();
      await sub.save();
      processedCount++;
    }

    res.json({ success: true, processedCount, message: `Processed ${processedCount} pending payment reminders.` });
  } catch (err) {
    res.status(500).json({ error: 'Error running payment reminders job.' });
  }
});

// Get all programs (optimized to exclude heavy cardTemplate by default to speed up slot selection)
app.get('/api/programs', async (req, res) => {
  try {
    const programs = await Program.find({}, {
      id: 1, sequenceNumber: 1, name: 1, slug: 1, city: 1, venue: 1, mapUrl: 1, description: 1,
      heroImage: 1, price: 1, status: 1, featured: 1, registrationMode: 1, externalRegistrationUrl: 1, sortOrder: 1,
      date: 1, time: 1, capacity: 1, bookingsCount: 1, isDateFinal: 1,
      heartX: 1, heartY: 1, heartWidth: 1, heartHeight: 1, photoZoom: 1, photoOffsetY: 1,
      photoLink: 1, isInquiryClosed: 1,
      hasTemplate: { $cond: [{ $eq: [{ $type: "$cardTemplate" }, "string"] }, true, false] }
    }).sort({ sortOrder: 1, sequenceNumber: 1, createdAt: 1 });

    // Map programs to include absolute URL path for cardTemplate instead of base64
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const mapped = await Promise.all(programs.map(async (p) => {
      const obj = p.toObject();
      const hasTemplate = p.get('hasTemplate') || false;
      obj.cardTemplate = hasTemplate ? `${protocol}://${host}/api/programs/${p.id}/template` : null;
      // Dynamic available seats
      const activeBookings = await getProgramBookingsCount(p.id);
      obj.activeBookings = activeBookings;
      obj.availableSeats = Math.max(0, p.capacity - activeBookings);

      // Fetch count of inquiries and pending reviews
      obj.inquiryCount = await Submission.countDocuments({ programId: p.id, status: 'inquiry' });
      obj.pendingCount = await Submission.countDocuments({ programId: p.id, status: 'pending' });
      obj.approvedCount = await Submission.countDocuments({ programId: p.id, status: 'approved' });
      obj.rejectedCount = await Submission.countDocuments({ programId: p.id, status: 'rejected' });

      // CPL counts
      obj.cplApproved = await Submission.countDocuments({ programId: p.id, status: 'approved', inquiryId: /^(CPL-|EK)/i });
      obj.cplPending = await Submission.countDocuments({ programId: p.id, status: 'pending', inquiryId: /^(CPL-|EK)/i });
      obj.cplInquiry = await Submission.countDocuments({ programId: p.id, status: 'inquiry', inquiryId: /^(CPL-|EK)/i });
      obj.cplRejected = await Submission.countDocuments({ programId: p.id, status: 'rejected', inquiryId: /^(CPL-|EK)/i });

      // IP counts
      obj.ipApproved = await Submission.countDocuments({ programId: p.id, status: 'approved', inquiryId: /^IP-/i });
      obj.ipPending = await Submission.countDocuments({ programId: p.id, status: 'pending', inquiryId: /^IP-/i });
      obj.ipInquiry = await Submission.countDocuments({ programId: p.id, status: 'inquiry', inquiryId: /^IP-/i });
      obj.ipRejected = await Submission.countDocuments({ programId: p.id, status: 'rejected', inquiryId: /^IP-/i });
      return obj;
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching programs.' });
  }
});

// Public programs endpoint for landing page
app.get('/api/programs/public', async (req, res) => {
  try {
    const programs = await Program.find(
      { status: { $nin: ['completed', 'archived', 'cancelled'] } },
      {
        id: 1, sequenceNumber: 1, name: 1, slug: 1, city: 1, venue: 1, mapUrl: 1, description: 1,
        heroImage: 1, price: 1, status: 1, featured: 1, registrationMode: 1, externalRegistrationUrl: 1, sortOrder: 1,
        date: 1, time: 1, capacity: 1, bookingsCount: 1, isDateFinal: 1, photoLink: 1, isInquiryClosed: 1
      }
    ).sort({ sortOrder: 1, sequenceNumber: 1, createdAt: 1 });

    const mapped = await Promise.all(programs.map(async (p) => {
      const obj = p.toObject();
      const activeBookings = await getProgramBookingsCount(p.id);
      obj.activeBookings = activeBookings;
      obj.availableSeats = Math.max(0, p.capacity - activeBookings);
      return obj;
    }));

    res.json({ programs: mapped, count: mapped.length });
  } catch (err) {
    console.error('Error in /api/programs/public:', err);
    res.status(500).json({ error: 'Server error fetching public programs.' });
  }
});


// Stream program card template endpoint (In-memory cached to eliminate MongoDB network delay)
const templateCache = new Map();

app.get('/api/programs/:id/template', async (req, res) => {
  const { id } = req.params;
  try {
    if (templateCache.has(id)) {
      const cached = templateCache.get(id);
      res.writeHead(200, {
        'Content-Type': cached.contentType,
        'Content-Length': cached.buffer.length,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end(cached.buffer);
    }

    let program = await Program.findOne({ id }, { cardTemplate: 1 });
    if (!program || !program.cardTemplate) {
      return res.status(404).send('Template not found');
    }

    let templateString = program.cardTemplate;

    // Check if it's an HTTP URL (which might be a self loop, reference to another program, or external Cloudinary image)
    if (templateString.startsWith('http://') || templateString.startsWith('https://')) {
      // 1. Check if it's a loop referring to itself (Forms a loop with this program's own template endpoint)
      const selfLoopMatch = templateString.match(/\/api\/programs\/([^\/]+)\/template/);
      if (selfLoopMatch) {
        const referencedId = selfLoopMatch[1];
        if (referencedId === id) {
          console.warn(`Template loop detected for program ${id}. Cannot resolve template self-referencing URL.`);
          return res.status(404).send('Template loop detected');
        }

        // 2. Resolve template from the other program internally
        const referencedProgram = await Program.findOne({ id: referencedId }, { cardTemplate: 1 });
        if (referencedProgram && referencedProgram.cardTemplate && !referencedProgram.cardTemplate.startsWith('http')) {
          templateString = referencedProgram.cardTemplate;
        } else {
          // Fallback: try to fetch it over HTTP
          try {
            const response = await fetch(templateString);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const contentType = response.headers.get('content-type') || 'image/png';
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Cache the buffer
            templateCache.set(id, { contentType, buffer });

            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': buffer.length,
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            return res.end(buffer);
          } catch (fetchErr) {
            console.error(`Error fetching template URL internally for ${id}:`, fetchErr);
            return res.status(404).send('Referenced template not found or failed to load');
          }
        }
      } else {
        // External URL (e.g. Cloudinary) - Fetch and stream directly
        try {
          const response = await fetch(templateString);
          if (!response.ok) throw new Error(`HTTP error ${response.status}`);
          const contentType = response.headers.get('content-type') || 'image/png';
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Cache the buffer
          templateCache.set(id, { contentType, buffer });

          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          });
          return res.end(buffer);
        } catch (fetchErr) {
          console.error(`Error fetching external template URL for ${id}:`, fetchErr);
          return res.status(404).send('External template failed to load');
        }
      }
    }

    // Now process templateString as base64 data URL
    const match = templateString.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const img = Buffer.from(base64Data, 'base64');

      // Cache the buffer
      templateCache.set(id, { contentType, buffer: img });

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': img.length,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end(img);
    } else {
      res.status(400).send('Invalid template format');
    }
  } catch (err) {
    console.error(`Server error in template stream for ${id}:`, err);
    res.status(500).send('Server error');
  }
});

// Create a new program (Admin protected)
app.post('/api/programs', requireAuth, async (req, res) => {
  const {
    name, date, time, capacity, cardTemplate, heartX, heartY, heartWidth, heartHeight,
    photoZoom, photoOffsetY, isDateFinal, photoLink, isInquiryClosed,
    slug, city, venue, mapUrl, description, heroImage, price, status, featured,
    registrationMode, externalRegistrationUrl, sortOrder
  } = req.body;
  const finalIsDateFinal = isDateFinal !== undefined ? isDateFinal : true;
  if (!name || !capacity || (finalIsDateFinal && !date)) {
    return res.status(400).json({ error: 'Name, date, and capacity are required.' });
  }
  try {
    const maxProg = await Program.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = maxProg && maxProg.sequenceNumber ? maxProg.sequenceNumber + 1 : 1;
    const finalSlug = (slug || generateEventSlug(name, city, date)).toLowerCase().trim();

    const newProgram = await Program.create({
      id: `prog-${Date.now()}`,
      sequenceNumber: nextSeq,
      name,
      slug: finalSlug,
      city: city || '',
      venue: venue || '',
      mapUrl: mapUrl || '',
      description: description || '',
      heroImage: heroImage || '',
      price: price ? parseFloat(price) : 1500,
      status: status || 'upcoming',
      featured: featured === true || featured === 'true',
      registrationMode: registrationMode || 'internal',
      externalRegistrationUrl: externalRegistrationUrl || '',
      sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
      date: finalIsDateFinal ? date : (date || 'TBD'),
      time: time || '8:30 PM',
      capacity: parseInt(capacity, 10),
      bookingsCount: 0,
      isDateFinal: finalIsDateFinal,
      cardTemplate,
      heartX: heartX !== undefined ? parseInt(heartX, 10) : 144,
      heartY: heartY !== undefined ? parseInt(heartY, 10) : 112,
      heartWidth: heartWidth !== undefined ? parseInt(heartWidth, 10) : 288,
      heartHeight: heartHeight !== undefined ? parseInt(heartHeight, 10) : 260,
      photoZoom: photoZoom !== undefined ? parseFloat(photoZoom) : 1.0,
      photoOffsetY: photoOffsetY !== undefined ? parseInt(photoOffsetY, 10) : 0,
      photoLink: photoLink || "",
      isInquiryClosed: isInquiryClosed !== undefined ? isInquiryClosed : false
    });
    res.status(201).json(newProgram);
  } catch (err) {
    console.error('Error creating program:', err);
    res.status(500).json({ error: 'Server error creating program.' });
  }
});

// Delete a program (Admin protected)
app.delete('/api/programs/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Program.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: 'Program not found.' });
    }
    // Invalidate cache
    templateCache.delete(id);
    res.json({ success: true, message: 'Program deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting program.' });
  }
});

// Update a program (Admin protected)
app.put('/api/programs/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    name, date, time, capacity, cardTemplate, heartX, heartY, heartWidth, heartHeight,
    photoZoom, photoOffsetY, isDateFinal, photoLink, isInquiryClosed,
    slug, city, venue, mapUrl, description, heroImage, price, status, featured,
    registrationMode, externalRegistrationUrl, sortOrder
  } = req.body;
  try {
    const program = await Program.findOne({ id });
    if (!program) {
      return res.status(404).json({ error: 'Program not found.' });
    }

    if (name) program.name = name;
    if (isDateFinal !== undefined) program.isDateFinal = isDateFinal;
    if (date) {
      program.date = date;
    } else if (program.isDateFinal === false) {
      program.date = 'TBD';
    }
    if (slug) program.slug = slug.toLowerCase().trim();
    if (city !== undefined) program.city = city;
    if (venue !== undefined) program.venue = venue;
    if (mapUrl !== undefined) program.mapUrl = mapUrl;
    if (description !== undefined) program.description = description;
    if (heroImage !== undefined) program.heroImage = heroImage;
    if (price !== undefined) program.price = parseFloat(price);
    if (status !== undefined) program.status = status;
    if (featured !== undefined) program.featured = featured === true || featured === 'true';
    if (registrationMode !== undefined) program.registrationMode = registrationMode;
    if (externalRegistrationUrl !== undefined) program.externalRegistrationUrl = externalRegistrationUrl;
    if (sortOrder !== undefined) program.sortOrder = parseInt(sortOrder, 10);
    if (time !== undefined) program.time = time;
    if (capacity) program.capacity = parseInt(capacity, 10);
    if (cardTemplate !== undefined) {
      if (cardTemplate === null) {
        program.cardTemplate = null;
      } else if (typeof cardTemplate === 'string' && !cardTemplate.startsWith('http')) {
        program.cardTemplate = cardTemplate;
      }
    }
    if (heartX !== undefined) program.heartX = parseInt(heartX, 10);
    if (heartY !== undefined) program.heartY = parseInt(heartY, 10);
    if (heartWidth !== undefined) program.heartWidth = parseInt(heartWidth, 10);
    if (heartHeight !== undefined) program.heartHeight = parseInt(heartHeight, 10);
    if (photoZoom !== undefined) program.photoZoom = parseFloat(photoZoom);
    if (photoOffsetY !== undefined) program.photoOffsetY = parseInt(photoOffsetY, 10);
    if (photoLink !== undefined) program.photoLink = photoLink;
    if (isInquiryClosed !== undefined) program.isInquiryClosed = isInquiryClosed;

    await program.save();
    // Invalidate cache
    templateCache.delete(id);
    res.json({ success: true, message: 'Program updated successfully.', data: program });
  } catch (err) {
    console.error('Error updating program:', err);
    res.status(500).json({ error: 'Server error updating program.' });
  }
});

// Submit Form (Razorpay first with legacy screenshot fallback support)
app.post('/api/submit', upload.fields([
  { name: 'couplePhoto', maxCount: 1 },
  { name: 'paymentScreenshot', maxCount: 1 }
]), async (req, res) => {
  try {
    const { husbandName, wifeName, surname, phoneNumber, programId } = req.body;

    if (!husbandName || !wifeName || !surname || !phoneNumber || !programId) {
      return res.status(400).json({ error: 'All fields including program/slot selection are required' });
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'કૃપા કરીને સાચો 10-આંકડાનો મોબાઇલ નંબર દાખલ કરો!' });
    }

    // Check if phone number is already registered for THIS specific program/event (excluding rejected and soft-deleted ones)
    const existingRegistration = await Submission.findOne({
      phoneNumber,
      programId,
      status: { $ne: 'rejected' },
      isDeleted: { $ne: true }
    });
    if (existingRegistration) {
      return res.status(400).json({
        error: 'આ મોબાઇલ નંબર પરથી આ પ્રોગ્રામ માટે રજીસ્ટ્રેશન પહેલેથી જ થઈ ગયું છે!',
        inquiryId: existingRegistration.inquiryId,
        alreadyRegistered: true
      });
    }

    // Find selected program and check capacity
    const program = await Program.findOne({ id: programId });
    if (!program) {
      return res.status(400).json({ error: 'Invalid program/slot selected' });
    }

    const isDateFinal = program.isDateFinal !== false;

    const activeBookings = await getProgramBookingsCount(programId);
    if (isDateFinal && (activeBookings + 2 > program.capacity)) {
      return res.status(400).json({ error: 'This program slot is sold out (not enough seats left for a couple).' });
    }

    const couplePhotoFile = req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;
    const paymentScreenshotFile = req.files['paymentScreenshot'] ? req.files['paymentScreenshot'][0] : null;

    if (!couplePhotoFile) {
      return res.status(400).json({ error: 'Couple photo is required' });
    }

    const programSeq = program.sequenceNumber || 1;
    const programSeqStr = String(programSeq).padStart(2, '0');

    const counterObj = await Counter.findOneAndUpdate(
      { name: `inquiryNumber_${programId}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const regSeqStr = String(counterObj.seq).padStart(2, '0');
    const inquiryId = `EK${programSeqStr}-${regSeqStr}`;
    const customerToken = crypto.randomBytes(16).toString('hex');

    // Upload files to Cloudinary
    const couplePhotoBase64 = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
    const couplePhotoUrl = await uploadToCloudinary(couplePhotoBase64, 'couplePhotos');

    let paymentScreenshotUrl = null;
    if (paymentScreenshotFile) {
      const paymentScreenshotBase64 = `data:${paymentScreenshotFile.mimetype};base64,${paymentScreenshotFile.buffer.toString('base64')}`;
      paymentScreenshotUrl = await uploadToCloudinary(paymentScreenshotBase64, 'paymentScreenshots');
    }

    const programPrice = program.price || 1500;
    const paymentProvider = paymentScreenshotFile ? 'legacy_upi' : 'razorpay';
    const initialPaymentStatus = 'pending';

    const newSubmission = await Submission.create({
      inquiryId,
      customerToken,
      husbandName,
      wifeName,
      surname,
      phoneNumber,
      programId,
      programName: program.name,
      programDate: program.date,
      programTime: program.time || "8:30 PM",
      couplePhoto: couplePhotoUrl,
      paymentScreenshot: paymentScreenshotUrl,
      payeeNameFromReceipt: paymentScreenshotFile ? 'Processing...' : 'Razorpay Online',
      status: 'pending',
      payment: {
        provider: paymentProvider,
        status: initialPaymentStatus,
        amount: programPrice,
        currency: 'INR',
        createdAt: new Date()
      },
      reservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour reservation
      createdAt: new Date()
    });

    // Update dynamic bookingsCount for the program in DB
    await updateProgramBookingsCount(programId);

    // Send instant response to client
    res.status(201).json({
      success: true,
      inquiryId: newSubmission.inquiryId,
      customerToken: newSubmission.customerToken,
      data: newSubmission
    });

    // Run heavy QR scan and Tesseract OCR text recognition asynchronously in the background (legacy/offline payments)
    if (paymentScreenshotFile) {
      setImmediate(async () => {
        try {
          let payeeNameFromReceipt = 'Not detected';
          let isUpiQr = false;
          let isValidReceipt = true;

          // 1. Jimp + jsQR check to see if the user uploaded the raw UPI QR code instead of receipt
          try {
            const image = await Jimp.read(paymentScreenshotFile.buffer);
            const qrCode = jsQR(
              new Uint8ClampedArray(image.bitmap.data),
              image.bitmap.width,
              image.bitmap.height
            );
            if (qrCode && qrCode.data && qrCode.data.includes('upi://pay')) {
              isUpiQr = true;
            }
          } catch (qrErr) {
            console.error('Error scanning QR code in background:', qrErr);
          }

          if (isUpiQr) {
            await Submission.updateOne(
              { inquiryId },
              {
                status: 'rejected',
                rejectionReason: 'તમે પેમેન્ટનો QR કોડ અપલોડ કર્યો છે. કૃપા કરીને પેમેન્ટ થયા પછીનો સક્સેસ સ્ક્રીનશોટ (Receipt) અપલોડ કરો!'
              }
            );
            return;
          }

          // 2. Tesseract OCR processing to verify text keywords
          try {
            const ocrResult = await Tesseract.recognize(
              paymentScreenshotFile.buffer,
              'eng'
            );
            const originalText = ocrResult.data.text;
            const text = originalText.toLowerCase();

            const keywords = [
              'success', 'successful', 'paid', 'payment', 'transferred', 'completed',
              'utr', 'txn', 'transaction', 'ref', 'gpay', 'phonepe', 'paytm', 'bhim',
              'sent', 'upi', 'to:', 'from:', 'rs', 'received', 'debit', 'credit'
            ];

            const hasKeyword = keywords.some(kw => {
              const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              if (kw.length <= 3 || kw.endsWith(':')) {
                const regex = new RegExp(`\\b${escaped}`, 'i');
                return regex.test(text);
              }
              return text.includes(kw);
            });

            if (!hasKeyword) {
              isValidReceipt = false;
            } else {
              // Attempt to parse who was paid
              const patterns = [
                /to\s*:\s*([A-Za-z0-9\s\.\-\&]+)/i,
                /paid\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i,
                /transfer\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i,
                /payment\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i,
                /sent\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i
              ];

              for (const pattern of patterns) {
                const match = originalText.match(pattern);
                if (match && match[1]) {
                  const extracted = match[1].split('\n')[0].trim();
                  if (extracted.length > 2 && !/^\d+$/.test(extracted)) {
                    payeeNameFromReceipt = extracted;
                    break;
                  }
                }
              }
            }
          } catch (ocrErr) {
            console.error('Background OCR validation error:', ocrErr);
          }

          if (!isValidReceipt) {
            await Submission.updateOne(
              { inquiryId },
              {
                status: 'rejected',
                rejectionReason: 'અપલોડ કરેલી ઈમેજ પેમેન્ટ રિસીપ્ટ કે કન્ફર્મેશન સ્ક્રીનશોટ નથી. કૃપા કરીને સાચો સક્સેસ સ્ક્રીનશોટ (Receipt) અપલોડ કરો!'
              }
            );
          } else {
            await Submission.updateOne(
              { inquiryId },
              { payeeNameFromReceipt }
            );
          }
        } catch (bgErr) {
          console.error('Background submission processing error:', bgErr);
        }
      });
    }

  } catch (error) {
    console.error('Error handling submission:', error);
    res.status(500).json({ error: `Server error processing submission: ${error.message || error}` });
  }
});

// Create manual invited people submission (Admin protected)
app.post('/api/submissions/manual', requireAuth, upload.fields([{ name: 'couplePhoto', maxCount: 1 }]), async (req, res) => {
  const { husbandName, wifeName, surname, phoneNumber, programId } = req.body;
  if (!husbandName || !wifeName || !surname || !phoneNumber || !programId) {
    return res.status(400).json({ error: 'All fields including program/slot selection are required.' });
  }
  try {
    const program = await Program.findOne({ id: programId });
    if (!program) {
      return res.status(400).json({ error: 'Invalid program/slot selected.' });
    }
    if (program.bookingsCount + 2 > program.capacity) {
      return res.status(400).json({ error: 'This program slot is sold out.' });
    }

    let couplePhotoUrl = '/sample_couple.png';
    const couplePhotoFile = req.files && req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;
    if (couplePhotoFile) {
      const couplePhotoBase64 = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
      couplePhotoUrl = await uploadToCloudinary(couplePhotoBase64, 'couplePhotos');
    }

    const nextSeq = await getNextInvitedNumber();
    const inquiryId = `IP-${nextSeq}`;

    const activeBookings = await getProgramBookingsCount(programId);
    if (activeBookings + 2 > program.capacity) {
      return res.status(400).json({ error: 'Cannot create manual submission: Program slot is full.' });
    }

    const newSubmission = await Submission.create({
      inquiryId,
      husbandName,
      wifeName,
      surname,
      phoneNumber,
      programId,
      programName: program.name,
      programDate: program.date,
      programTime: program.time || "8:30 PM",
      couplePhoto: couplePhotoUrl,
      paymentScreenshot: null,
      payeeNameFromReceipt: 'Offline Invitee Entry',
      status: 'approved',
      createdAt: new Date()
    });

    await updateProgramBookingsCount(programId);

    res.status(201).json({
      success: true,
      data: newSubmission
    });
  } catch (error) {
    console.error('Error creating manual submission:', error);
    res.status(500).json({ error: 'Server error creating manual submission.' });
  }
});

// Approve Submission (Admin protected)
app.post('/api/submissions/:inquiryId/approve', requireAuth, async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    if (submission.status !== 'approved') {
      const isTransitioningFromInquiry = submission.status === 'inquiry' || !submission.status;
      if (isTransitioningFromInquiry && submission.programId) {
        const program = await Program.findOne({ id: submission.programId });
        if (program) {
          const activeBookings = await getProgramBookingsCount(submission.programId);
          if (activeBookings + 2 > program.capacity) {
            return res.status(400).json({ error: 'Cannot approve submission: Program slot is already full (SOLD OUT).' });
          }
        }
      }

      submission.status = 'approved';
      await submission.save();

      // Trigger dynamic update of bookings count
      if (submission.programId) {
        await updateProgramBookingsCount(submission.programId);
      }
    }

    res.json({ success: true, message: 'Submission approved successfully.', data: submission });
  } catch (err) {
    res.status(500).json({ error: 'Server error approving submission.' });
  }
});

// Reject Submission (Admin protected)
app.post('/api/submissions/:inquiryId/reject', requireAuth, async (req, res) => {
  const { inquiryId } = req.params;
  const { reason } = req.body;
  try {
    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const oldProgramId = submission.programId;

    submission.status = 'rejected';
    submission.rejectionReason = reason || 'Payment verification failed.';
    await submission.save();

    if (oldProgramId) {
      await updateProgramBookingsCount(oldProgramId);
    }

    res.json({ success: true, message: 'Submission rejected.', data: submission });
  } catch (err) {
    res.status(500).json({ error: 'Server error rejecting submission.' });
  }
});

// Delete a single submission (Admin only - now soft deleted to Trash)
app.delete('/api/submissions/:inquiryId', requireAuth, async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const programId = submission.programId;

    // Soft delete by setting isDeleted = true
    submission.isDeleted = true;
    await submission.save();

    if (programId) {
      await updateProgramBookingsCount(programId);
    }

    res.json({ success: true, message: `Submission ${inquiryId} moved to Trash.` });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Server error while deleting submission.' });
  }
});

// Bulk delete submissions (Admin only - soft deleted to Trash)
app.post('/api/submissions/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { inquiryIds } = req.body;
    if (!Array.isArray(inquiryIds) || inquiryIds.length === 0) {
      return res.status(400).json({ error: 'No inquiry IDs provided.' });
    }

    const submissions = await Submission.find({ inquiryId: { $in: inquiryIds } });
    const programIds = [...new Set(submissions.map(s => s.programId).filter(Boolean))];

    // Soft delete documents
    await Submission.updateMany(
      { inquiryId: { $in: inquiryIds } },
      { isDeleted: true }
    );

    // Update dynamic bookingsCount for all affected programs
    for (const pid of programIds) {
      await updateProgramBookingsCount(pid);
    }

    res.json({ success: true, message: `${submissions.length} submissions moved to Trash.` });
  } catch (error) {
    console.error('Error bulk deleting submissions:', error);
    res.status(500).json({ error: 'Server error while bulk deleting submissions.' });
  }
});

// Bulk move submissions to another program (Admin only)
app.post('/api/submissions/bulk-move', requireAuth, async (req, res) => {
  try {
    const { inquiryIds, targetProgramId } = req.body;
    if (!Array.isArray(inquiryIds) || inquiryIds.length === 0) {
      return res.status(400).json({ error: 'કોઈ ઇન્ક્વાયરી પસંદ કરેલ નથી.' });
    }
    if (!targetProgramId) {
      return res.status(400).json({ error: 'કૃપા કરીને નવો પ્રોગ્રામ પસંદ કરો.' });
    }

    const targetProgram = await Program.findOne({ id: targetProgramId });
    if (!targetProgram) {
      return res.status(404).json({ error: 'પસંદ કરેલ પ્રોગ્રામ મળ્યો નથી.' });
    }

    // Find all submissions to be moved
    const submissions = await Submission.find({ inquiryId: { $in: inquiryIds }, isDeleted: { $ne: true } });
    if (submissions.length === 0) {
      return res.status(400).json({ error: 'કોઈ માન્ય ઇન્ક્વાયરી મળી નથી.' });
    }

    // Identify which ones are changing their program and are active (approved/pending)
    const activeSubmissionsToMoveCount = submissions.filter(
      s => ['approved', 'pending'].includes(s.status) && s.programId !== targetProgramId
    ).length;

    if (activeSubmissionsToMoveCount > 0) {
      const activeBookings = await getProgramBookingsCount(targetProgramId);
      const neededCapacity = activeSubmissionsToMoveCount * 2;
      if (activeBookings + neededCapacity > targetProgram.capacity) {
        return res.status(400).json({
          error: `પસંદ કરેલ પ્રોગ્રામ સ્લોટમાં પૂરતી જગ્યા નથી! (જરૂરી સીટો: ${neededCapacity}, ખાલી સીટો: ${targetProgram.capacity - activeBookings})`
        });
      }
    }

    // Collect all original program IDs to update their bookingsCount later
    const sourceProgramIds = [...new Set(submissions.map(s => s.programId).filter(Boolean))];

    const programSeq = targetProgram.sequenceNumber || 1;
    const programSeqStr = String(programSeq).padStart(2, '0');

    // Update submissions in database sequentially to regenerate inquiryId
    for (const sub of submissions) {
      if (sub.programId !== targetProgramId) {
        const counterObj = await Counter.findOneAndUpdate(
          { name: `inquiryNumber_${targetProgramId}` },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        const regSeqStr = String(counterObj.seq).padStart(2, '0');
        sub.inquiryId = `EK${programSeqStr}-${regSeqStr}`;
      }
      sub.programId = targetProgram.id;
      sub.programName = targetProgram.name;
      sub.programDate = targetProgram.date;
      sub.programTime = targetProgram.time || "8:30 PM";
      await sub.save();
    }

    // Update bookings count for all affected source programs and the target program
    for (const pid of sourceProgramIds) {
      await updateProgramBookingsCount(pid);
    }
    await updateProgramBookingsCount(targetProgramId);

    res.json({
      success: true,
      message: `${submissions.length} ઇન્ક્વાયરીઝ સફળતાપૂર્વક નવા પ્રોગ્રામમાં ટ્રાન્સફર કરવામાં આવી છે.`
    });
  } catch (error) {
    console.error('Error bulk moving submissions:', error);
    res.status(500).json({ error: 'સર્વર ભૂલ: ઇન્ક્વાયરી ટ્રાન્સફર કરવામાં સમસ્યા આવી.' });
  }
});


// Restore a single submission from Trash (Admin only)
app.post('/api/submissions/:inquiryId/restore', requireAuth, async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    submission.isDeleted = false;
    await submission.save();

    if (submission.programId) {
      await updateProgramBookingsCount(submission.programId);
    }

    res.json({ success: true, message: `Submission ${inquiryId} restored successfully.`, submission });
  } catch (err) {
    console.error('Error restoring submission:', err);
    res.status(500).json({ error: 'Server error restoring submission.' });
  }
});

// Permanent delete a single submission (Admin only)
app.delete('/api/submissions/:inquiryId/permanent', requireAuth, async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const deleted = await Submission.findOneAndDelete({ inquiryId });
    if (!deleted) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    res.json({ success: true, message: `Submission ${inquiryId} permanently deleted.` });
  } catch (error) {
    console.error('Error permanently deleting submission:', error);
    res.status(500).json({ error: 'Server error while permanently deleting submission.' });
  }
});

// Get all trashed submissions (Admin protected)
app.get('/api/submissions/trash', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    let filter = { isDeleted: true };

    const totalSubmissions = await Submission.countDocuments(filter);
    const totalPages = Math.ceil(totalSubmissions / limit);

    const submissions = await Submission.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const mappedSubmissions = submissions.map(sub => {
      const obj = sub.toObject();
      if (obj.couplePhoto && !obj.couplePhoto.startsWith('http')) {
        obj.couplePhoto = `/api/submissions/${sub.inquiryId}/photo`;
      }
      if (obj.paymentScreenshot && !obj.paymentScreenshot.startsWith('http')) {
        obj.paymentScreenshot = `/api/submissions/${sub.inquiryId}/screenshot`;
      }
      return obj;
    });

    res.json({
      submissions: mappedSubmissions,
      totalPages,
      totalSubmissions,
      currentPage: page
    });
  } catch (err) {
    console.error('Error fetching trash submissions:', err);
    res.status(500).json({ error: 'Server error fetching trash submissions.' });
  }
});

// Update attendance for a single submission (Admin protected)
app.post('/api/submissions/:inquiryId/attendance', requireAuth, async (req, res) => {
  const { inquiryId } = req.params;
  const { attendance } = req.body; // 'present', 'absent', 'unmarked'
  if (!['present', 'absent', 'unmarked'].includes(attendance)) {
    return res.status(400).json({ error: 'Invalid attendance status.' });
  }
  try {
    const sub = await Submission.findOneAndUpdate({ inquiryId }, { attendance }, { new: true });
    if (!sub) return res.status(404).json({ error: 'Submission not found.' });
    res.json({ success: true, submission: sub });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating attendance.' });
  }
});

// Update attendance in bulk (Admin protected)
app.post('/api/submissions/bulk-attendance', requireAuth, async (req, res) => {
  const { inquiryIds, attendance } = req.body; // inquiryIds: Array of strings, attendance: 'present' | 'absent' | 'unmarked'
  if (!Array.isArray(inquiryIds) || !['present', 'absent', 'unmarked'].includes(attendance)) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }
  try {
    await Submission.updateMany({ inquiryId: { $in: inquiryIds } }, { attendance });
    res.json({ success: true, message: 'Bulk attendance updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating bulk attendance.' });
  }
});

// Update attendance by setting specified inquiry IDs as absent, and all other approved as present
app.post('/api/submissions/attendance-by-absentees', requireAuth, async (req, res) => {
  const { programId, absentInquiryIds } = req.body;
  if (!programId || !Array.isArray(absentInquiryIds)) {
    return res.status(400).json({ error: 'Program ID and absent inquiry IDs array are required.' });
  }

  try {
    const formattedAbsentIds = absentInquiryIds.map(id => id.trim().toUpperCase()).filter(Boolean);

    // 1. Mark all approved submissions for this program as 'present'
    await Submission.updateMany(
      { programId, status: 'approved' },
      { attendance: 'present' }
    );

    // 2. Mark specified absent submissions as 'absent'
    if (formattedAbsentIds.length > 0) {
      await Submission.updateMany(
        { programId, status: 'approved', inquiryId: { $in: formattedAbsentIds } },
        { attendance: 'absent' }
      );
    }

    res.json({ success: true, message: 'Attendance updated successfully by absentees list.' });
  } catch (err) {
    console.error('Error updating attendance by absentees:', err);
    res.status(500).json({ error: 'Server error updating attendance by absentees.' });
  }
});


// Edit a registration submission (Admin only)
app.put('/api/submissions/:inquiryId', requireAuth, upload.fields([
  { name: 'couplePhoto', maxCount: 1 },
  { name: 'paymentScreenshot', maxCount: 1 }
]), async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { husbandName, wifeName, surname, phoneNumber, programId, photoZoom, photoOffsetY, status, rejectionReason, refundReason } = req.body;

    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const oldProgramId = submission.programId;
    const newProgramId = programId || oldProgramId;
    const oldStatus = submission.status;
    const newStatus = status !== undefined ? status : oldStatus;

    // Check capacity if the submission becomes active (pending or approved) in the target program
    const isNowActive = ['approved', 'pending'].includes(newStatus);
    const wasActiveInNew = ['approved', 'pending'].includes(oldStatus) && oldProgramId === newProgramId;

    if (isNowActive && !wasActiveInNew) {
      const targetProgram = await Program.findOne({ id: newProgramId });
      if (targetProgram) {
        const activeBookings = await getProgramBookingsCount(newProgramId);
        if (activeBookings + 2 > targetProgram.capacity) {
          return res.status(400).json({ error: 'Cannot update: Selected program slot is full.' });
        }
      }
    }

    // Apply updates
    submission.status = newStatus;
    if (rejectionReason !== undefined) submission.rejectionReason = rejectionReason;
    if (refundReason !== undefined) submission.refundReason = refundReason;

    if (husbandName) submission.husbandName = husbandName;
    if (wifeName) submission.wifeName = wifeName;
    if (surname) submission.surname = surname;
    if (phoneNumber) {
      if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'કૃપા કરીને સાચો 10-આંકડાનો મોબાઇલ નંબર દાખલ કરો!' });
      }
      submission.phoneNumber = phoneNumber;
    }
    if (photoZoom !== undefined) submission.photoZoom = parseFloat(photoZoom);
    if (photoOffsetY !== undefined) submission.photoOffsetY = parseInt(photoOffsetY, 10);

    if (programId && programId !== oldProgramId) {
      const newProgram = await Program.findOne({ id: programId });
      if (newProgram) {
        submission.programId = programId;
        submission.programName = newProgram.name;
        submission.programDate = newProgram.date;
        submission.programTime = newProgram.time || "8:30 PM";
      }
    }

    // Handle photo updates (Cloudinary upload)
    const couplePhotoFile = req.files && req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;
    const paymentScreenshotFile = req.files && req.files['paymentScreenshot'] ? req.files['paymentScreenshot'][0] : null;

    if (couplePhotoFile) {
      const couplePhotoBase64 = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
      submission.couplePhoto = await uploadToCloudinary(couplePhotoBase64, 'couplePhotos');
    }

    if (paymentScreenshotFile) {
      const paymentScreenshotBase64 = `data:${paymentScreenshotFile.mimetype};base64,${paymentScreenshotFile.buffer.toString('base64')}`;
      submission.paymentScreenshot = await uploadToCloudinary(paymentScreenshotBase64, 'paymentScreenshots');
    }

    await submission.save();

    // Trigger dynamic update of bookings counts for both old and new programs
    if (oldProgramId) {
      await updateProgramBookingsCount(oldProgramId);
    }
    if (newProgramId && newProgramId !== oldProgramId) {
      await updateProgramBookingsCount(newProgramId);
    }

    res.json({ success: true, message: `Submission ${inquiryId} updated successfully.`, data: submission });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ error: 'Server error while updating submission.' });
  }
});



// Public status check by Inquiry ID
app.get('/api/submissions/status/:inquiryId', async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const formattedId = (inquiryId || '').trim().toUpperCase();
    const submission = await Submission.findOne({ $or: [{ inquiryId: formattedId }, { oldInquiryId: formattedId }] });
    if (!submission) {
      return res.status(404).json({ error: 'Inquiry ID not found.' });
    }

    // Look up the program to get the cardTemplate, layouts, and time
    let cardTemplate = null;
    let heartX = 144;
    let heartY = 112;
    let heartWidth = 288;
    let heartHeight = 260;
    let photoZoom = 1.0;
    let photoOffsetY = 0;
    let programTime = submission.programTime || "8:30 PM";

    let isDateFinal = true;
    if (submission.programId) {
      const program = await Program.findOne(
        { id: submission.programId },
        {
          id: 1, name: 1, date: 1, time: 1, isDateFinal: 1, heartX: 1, heartY: 1, heartWidth: 1, heartHeight: 1, photoZoom: 1, photoOffsetY: 1,
          hasTemplate: { $cond: [{ $eq: [{ $type: "$cardTemplate" }, "string"] }, true, false] }
        }
      );
      if (program) {
        isDateFinal = program.isDateFinal !== false;
        submission.programDate = program.date;
        if (program.get('hasTemplate')) {
          const protocol = req.headers['x-forwarded-proto'] || req.protocol;
          const host = req.get('host');
          cardTemplate = `${protocol}://${host}/api/programs/${program.id}/template`;
        }
        if (program.heartX !== undefined) heartX = program.heartX;
        if (program.heartY !== undefined) heartY = program.heartY;
        if (program.heartWidth !== undefined) heartWidth = program.heartWidth;
        if (program.heartHeight !== undefined) heartHeight = program.heartHeight;
        if (program.photoZoom !== undefined) photoZoom = program.photoZoom;
        if (program.photoOffsetY !== undefined) photoOffsetY = program.photoOffsetY;
        if (program.time) programTime = program.time;
      }
    }

    let upiId = 'payee@upi';
    let payeeName = 'Couple Pass';
    let amount = '100';
    try {
      const setting = await Setting.findOne({ key: 'main' });
      if (setting) {
        upiId = setting.upiId;
        payeeName = setting.payeeName;
        amount = setting.amount;
      }
    } catch (settingErr) {
      console.error('Error fetching settings for status:', settingErr);
    }

    res.json({
      inquiryId: submission.inquiryId,
      husbandName: submission.husbandName,
      wifeName: submission.wifeName,
      surname: submission.surname,
      phoneNumber: submission.phoneNumber,
      programId: submission.programId,
      programName: submission.programName,
      programDate: submission.programDate,
      programTime,
      couplePhoto: submission.couplePhoto ? `/api/submissions/${submission.inquiryId}/photo` : null,
      paymentScreenshot: submission.paymentScreenshot ? `/api/submissions/${submission.inquiryId}/screenshot` : null,
      status: submission.status,
      rejectionReason: submission.rejectionReason,
      refundReason: submission.refundReason || '',
      isDateFinal,
      upiId,
      payeeName,
      amount,
      cardTemplate,
      heartX,
      heartY,
      heartWidth,
      heartHeight,
      photoZoom,
      photoOffsetY
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error checking status.' });
  }
});

// Public endpoint for submitting payment screenshot for an inquiry
app.post('/api/submissions/:inquiryId/pay', upload.fields([
  { name: 'paymentScreenshot', maxCount: 1 }
]), async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const formattedId = (inquiryId || '').trim().toUpperCase();
    const submission = await Submission.findOne({ $or: [{ inquiryId: formattedId }, { oldInquiryId: formattedId }] });
    if (!submission) {
      return res.status(404).json({ error: 'Inquiry not found.' });
    }

    if (submission.status !== 'inquiry') {
      return res.status(400).json({ error: 'This submission is not in inquiry state.' });
    }

    const program = await Program.findOne({ id: submission.programId });
    if (!program) {
      return res.status(400).json({ error: 'Program not found.' });
    }

    if (program.isDateFinal === false) {
      return res.status(400).json({ error: 'The program date is not finalized yet.' });
    }



    const paymentScreenshotFile = req.files && req.files['paymentScreenshot'] ? req.files['paymentScreenshot'][0] : null;
    if (!paymentScreenshotFile) {
      return res.status(400).json({ error: 'Payment screenshot is required.' });
    }

    const paymentScreenshotBase64 = `data:${paymentScreenshotFile.mimetype};base64,${paymentScreenshotFile.buffer.toString('base64')}`;
    const paymentScreenshotUrl = await uploadToCloudinary(paymentScreenshotBase64, 'paymentScreenshots');

    // Increment UPI bookings count
    try {
      const settings = await Setting.findOne({ key: 'main' });
      if (settings) {
        settings.upiBookingsCount = (settings.upiBookingsCount || 0) + 1;
        if (settings.upiBookingsCount >= settings.upiLimit) {
          if (settings.upiIds && settings.upiIds.length > 1) {
            const oldUpi = settings.upiId;
            const nextIndex = (settings.activeUpiIndex + 1) % settings.upiIds.length;
            settings.activeUpiIndex = nextIndex;
            settings.upiId = settings.upiIds[nextIndex];
            settings.upiBookingsCount = 0; // reset counter

            await Notification.create({
              title: 'UPI Auto-Rotated',
              message: `૫૦ સબમિશન પૂર્ણ થવાના કારણે UPI ID આપોઆપ બદલાઈ ગયું છે. જૂનું UPI: ${oldUpi}, નવું એક્ટિવ UPI: ${settings.upiId}`,
              type: 'info'
            });
          } else {
            settings.upiBookingsCount = settings.upiLimit; // keep at limit
            await Notification.create({
              title: 'UPI Limit Reached!',
              message: `ચાલુ UPI ID (${settings.upiId}) પર ૫૦ સબમિશન પૂર્ણ થઈ ગયા છે. કૃપા કરીને એડમિન પેનલમાંથી નવું UPI ID સેટ કરો.`,
              type: 'error'
            });
          }
        }
        await settings.save();
      }
    } catch (err) {
      console.error('Error in UPI auto-rotation tracking:', err);
    }

    submission.paymentScreenshot = paymentScreenshotUrl;
    submission.status = 'pending';
    submission.payeeNameFromReceipt = 'Processing...';
    // Update live program date details to ensure submission stays accurate
    submission.programDate = program.date;
    submission.programTime = program.time || "8:30 PM";
    await submission.save();

    // Update dynamic bookingsCount for the program in DB
    await updateProgramBookingsCount(submission.programId);

    res.json({ success: true, message: 'Payment screenshot uploaded successfully.' });

    // Run heavy QR scan and Tesseract OCR text recognition asynchronously in the background
    setImmediate(async () => {
      try {
        let payeeNameFromReceipt = 'Not detected';
        let isUpiQr = false;
        let isValidReceipt = true;

        // 1. Jimp + jsQR check to see if the user uploaded the raw UPI QR code instead of receipt
        try {
          const image = await Jimp.read(paymentScreenshotFile.buffer);
          const qrCode = jsQR(
            new Uint8ClampedArray(image.bitmap.data),
            image.bitmap.width,
            image.bitmap.height
          );
          if (qrCode && qrCode.data && qrCode.data.includes('upi://pay')) {
            isUpiQr = true;
          }
        } catch (qrErr) {
          console.error('Error scanning QR code in background:', qrErr);
        }

        if (isUpiQr) {
          await Submission.updateOne(
            { inquiryId: formattedId },
            {
              status: 'rejected',
              rejectionReason: 'તમે પેમેન્ટનો QR કોડ અપલોડ કર્યો છે. કૃપા કરીને પેમેન્ટ થયા પછીનો સક્સેસ સ્ક્રીનશોટ (Receipt) અપલોડ કરો!'
            }
          );
          return;
        }

        // 2. Tesseract OCR processing to verify text keywords
        try {
          const ocrResult = await Tesseract.recognize(
            paymentScreenshotFile.buffer,
            'eng'
          );
          const originalText = ocrResult.data.text;
          const text = originalText.toLowerCase();

          const keywords = [
            'success', 'successful', 'paid', 'payment', 'transferred', 'completed',
            'utr', 'txn', 'transaction', 'ref', 'gpay', 'phonepe', 'paytm', 'bhim',
            'sent', 'upi', 'to:', 'from:', 'rs', 'received', 'debit', 'credit'
          ];

          const hasKeyword = keywords.some(kw => {
            const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (kw.length <= 3 || kw.endsWith(':')) {
              const regex = new RegExp(`\\b${escaped}`, 'i');
              return regex.test(text);
            }
            return text.includes(kw);
          });

          if (!hasKeyword) {
            isValidReceipt = false;
          } else {
            // Attempt to parse who was paid
            const patterns = [
              /to\s*:\s*([A-Za-z0-9\s\.\-\&]+)/i,
              /paid\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i,
              /transfer\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i,
              /payment\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i,
              /sent\s+to\s+([A-Za-z0-9\s\.\-\&]+)/i
            ];

            for (const pattern of patterns) {
              const match = originalText.match(pattern);
              if (match && match[1]) {
                const extracted = match[1].split('\n')[0].trim();
                if (extracted.length > 2 && !/^\d+$/.test(extracted)) {
                  payeeNameFromReceipt = extracted;
                  break;
                }
              }
            }
          }
        } catch (ocrErr) {
          console.error('Background OCR validation error:', ocrErr);
        }

        if (!isValidReceipt) {
          await Submission.updateOne(
            { inquiryId: formattedId },
            {
              status: 'rejected',
              rejectionReason: 'અપલોડ કરેલી ઈમેજ પેમેન્ટ રિસીપ્ટ કે કન્ફર્મેશન સ્ક્રીનશોટ નથી. કૃપા કરીને સાચો સક્સેસ સ્ક્રીનશોટ (Receipt) અપલોડ કરો!'
            }
          );
        } else {
          await Submission.updateOne(
            { inquiryId: formattedId },
            { payeeNameFromReceipt }
          );
        }
      } catch (bgErr) {
        console.error('Background submission processing error:', bgErr);
      }
    });
  } catch (error) {
    console.error('Error handling payment upload:', error);
    res.status(500).json({ error: `Server error processing payment upload: ${error.message || error}` });
  }
});

// Public endpoint for a couple to change their program slot (Only allowed in 'inquiry' status)
app.post('/api/submissions/:inquiryId/change-slot', async (req, res) => {
  const { inquiryId } = req.params;
  const { targetProgramId } = req.body;
  try {
    const formattedId = (inquiryId || '').trim().toUpperCase();
    const submission = await Submission.findOne({ $or: [{ inquiryId: formattedId }, { oldInquiryId: formattedId }] });
    if (!submission) {
      return res.status(404).json({ error: 'ઇન્ક્વાયરી મળી નથી.' });
    }

    // CRITICAL RULE: Only allow slot change if status is 'inquiry'
    if (submission.status !== 'inquiry') {
      return res.status(400).json({ error: 'પ્રોગ્રામ સ્લોટ ફક્ત ઇન્ક્વાયરી સ્ટેટસ દરમિયાન જ બદલી શકાય છે.' });
    }

    if (!targetProgramId) {
      return res.status(400).json({ error: 'કૃપા કરીને નવો પ્રોગ્રામ પસંદ કરો.' });
    }

    const targetProgram = await Program.findOne({ id: targetProgramId });
    if (!targetProgram) {
      return res.status(404).json({ error: 'પસંદ કરેલ પ્રોગ્રામ મળ્યો નથી.' });
    }

    const oldProgramId = submission.programId;
    if (oldProgramId !== targetProgramId) {
      const activeBookings = await getProgramBookingsCount(targetProgramId);
      if (activeBookings + 2 > targetProgram.capacity) {
        return res.status(400).json({ error: 'આ પ્રોગ્રામ સ્લોટ હાઉસફુલ (SOLD OUT) છે. કૃપા કરીને બીજો સ્લોટ પસંદ કરો.' });
      }
    }

    // Update submission
    let newInquiryId = submission.inquiryId;
    if (oldProgramId !== targetProgramId) {
      const programSeq = targetProgram.sequenceNumber || 1;
      const programSeqStr = String(programSeq).padStart(2, '0');

      const counterObj = await Counter.findOneAndUpdate(
        { name: `inquiryNumber_${targetProgramId}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const regSeqStr = String(counterObj.seq).padStart(2, '0');
      newInquiryId = `EK${programSeqStr}-${regSeqStr}`;
    }

    submission.inquiryId = newInquiryId;
    submission.programId = targetProgram.id;
    submission.programName = targetProgram.name;
    submission.programDate = targetProgram.date;
    submission.programTime = targetProgram.time || "8:30 PM";
    await submission.save();

    if (oldProgramId) {
      await updateProgramBookingsCount(oldProgramId);
    }
    await updateProgramBookingsCount(targetProgramId);

    res.json({ success: true, message: 'પ્રોગ્રામ સ્લોટ સફળતાપૂર્વક બદલવામાં આવ્યો છે.', data: submission });
  } catch (error) {
    console.error('Error changing slot:', error);
    res.status(500).json({ error: 'સર્વર ભૂલ: સ્લોટ બદલવામાં સમસ્યા આવી.' });
  }
});

// Export all submissions to CSV (supports header Authorization or query key parameter for Google Sheets)
app.get('/api/submissions/export', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const queryKey = req.query.key;

    if (
      authHeader !== ADMIN_PASSWORD &&
      authHeader !== SUPER_ADMIN_PASSWORD &&
      queryKey !== ADMIN_PASSWORD &&
      queryKey !== SUPER_ADMIN_PASSWORD
    ) {
      return res.status(401).json({ error: 'Unauthorized. Invalid password.' });
    }

    const { programId, status, type } = req.query;
    const query = {};
    if (programId) query.programId = programId;
    if (status) query.status = status;
    if (type === 'ip') {
      query.inquiryId = /^IP-/i;
    } else if (type === 'cpl') {
      query.inquiryId = /^(CPL-|EK)/i;
    }

    const submissions = await Submission.find(query).sort({ createdAt: -1 });
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    const headers = [
      'Inquiry ID',
      'Husband Name',
      'Wife Name',
      'Surname',
      'Phone Number',
      'Program ID',
      'Program Name',
      'Program Date',
      'Program Time',
      'Couple Photo',
      'Payment Screenshot',
      'Payee Name From Receipt',
      'Status',
      'Rejection Reason',
      'Created At'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str}"`;
      }
      return str;
    };

    const rows = submissions.map(sub => {
      const couplePhotoFormula = sub.couplePhoto
        ? (sub.couplePhoto.startsWith('http') ? `=IMAGE("${sub.couplePhoto}")` : `=IMAGE("${baseUrl}/api/submissions/${sub.inquiryId}/photo")`)
        : '';
      const paymentScreenshotFormula = sub.paymentScreenshot
        ? (sub.paymentScreenshot.startsWith('http') ? `=IMAGE("${sub.paymentScreenshot}")` : `=IMAGE("${baseUrl}/api/submissions/${sub.inquiryId}/screenshot")`)
        : '';
      return [
        sub.inquiryId,
        sub.husbandName,
        sub.wifeName,
        sub.surname,
        sub.phoneNumber,
        sub.programId,
        sub.programName,
        sub.programDate,
        sub.programTime || '8:30 PM',
        couplePhotoFormula,
        paymentScreenshotFormula,
        sub.payeeNameFromReceipt || 'Not detected',
        sub.status,
        sub.rejectionReason || '',
        sub.createdAt ? sub.createdAt.toISOString() : ''
      ].map(escapeCSV).join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n'); // Add BOM for Excel UTF-8 support

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=submissions_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error exporting submissions:', err);
    res.status(500).json({ error: 'Server error exporting submissions.' });
  }
});

// Get all submissions (for admin view/verification) - optimized with server-side pagination, sorting, and search
app.get('/api/submissions', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const programId = req.query.programId || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const attendance = req.query.attendance || '';

    let filter = { isDeleted: { $ne: true } };
    if (search) {
      const trimmedSearch = search.trim();
      const digitsOnly = trimmedSearch.replace(/\D/g, '');
      const escaped = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      const orConditions = [
        { inquiryId: searchRegex },
        { oldInquiryId: searchRegex },
        { husbandName: searchRegex },
        { wifeName: searchRegex },
        { surname: searchRegex },
        { phoneNumber: searchRegex }
      ];

      // Multi-word name matching (e.g. "Rajesh Patel")
      const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
      if (words.length > 1) {
        const wordRegexes = words.map(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
        orConditions.push({
          $and: wordRegexes.map(r => ({
            $or: [
              { husbandName: r },
              { wifeName: r },
              { surname: r },
              { inquiryId: r }
            ]
          }))
        });
      }

      if (digitsOnly.length >= 3) {
        orConditions.push({ phoneNumber: new RegExp(digitsOnly, 'i') });
      }

      filter.$or = orConditions;
    }
    if (status) {
      filter.status = status;
    }
    if (req.query.paymentStatus) {
      filter['payment.status'] = req.query.paymentStatus;
    }
    if (req.query.paymentProvider) {
      filter['payment.provider'] = req.query.paymentProvider;
    }
    if (programId) {
      filter.programId = programId;
    }
    if (attendance) {
      filter.attendance = attendance;
    }
    const type = req.query.type || '';
    if (type === 'ip') {
      filter.inquiryId = /^IP-/i;
    } else if (type === 'cpl') {
      filter.inquiryId = /^(CPL-|EK)/i;
    }

    console.log('--- API query:', req.query, 'Mongo filter:', JSON.stringify(filter));

    const totalSubmissions = await Submission.countDocuments(filter);
    const totalPages = Math.ceil(totalSubmissions / limit);

    const submissions = await Submission.find(filter, {
      inquiryId: 1,
      husbandName: 1,
      wifeName: 1,
      surname: 1,
      phoneNumber: 1,
      programId: 1,
      programName: 1,
      programDate: 1,
      programTime: 1,
      payeeNameFromReceipt: 1,
      status: 1,
      payment: 1,
      reservationExpiresAt: 1,
      rejectionReason: 1,
      refundReason: 1,
      createdAt: 1,
      couplePhoto: 1,
      paymentScreenshot: 1,
      attendance: 1
    }, { allowDiskUse: true })
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit);

    // Map submissions to use proxy endpoints for consistent CORS handling
    const mappedSubmissions = submissions.map(sub => {
      const obj = sub.toObject();

      if (sub.couplePhoto) {
        obj.couplePhoto = `/api/submissions/${sub.inquiryId}/photo`;
      } else {
        obj.couplePhoto = null;
      }

      if (sub.paymentScreenshot) {
        obj.paymentScreenshot = `/api/submissions/${sub.inquiryId}/screenshot`;
      } else {
        obj.paymentScreenshot = null;
      }

      return obj;
    });

    res.json({
      submissions: mappedSubmissions,
      totalPages,
      currentPage: page,
      totalSubmissions
    });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'Server error fetching submissions.' });
  }
});

// Get duplicate submissions grouped by conflict type (phone or name) - High Performance O(N)
app.get('/api/submissions/duplicates', requireAuth, async (req, res) => {
  try {
    const allSubmissions = await Submission.find(
      { isDeleted: { $ne: true } },
      {
        inquiryId: 1,
        oldInquiryId: 1,
        husbandName: 1,
        wifeName: 1,
        surname: 1,
        phoneNumber: 1,
        status: 1,
        programId: 1,
        programName: 1,
        programDate: 1,
        createdAt: 1,
        attendance: 1,
        hasCouplePhoto: { $cond: [{ $ifNull: ["$couplePhoto", false] }, true, false] },
        hasPaymentScreenshot: { $cond: [{ $ifNull: ["$paymentScreenshot", false] }, true, false] }
      }
    ).lean();

    const norm = (str) => (str || '').toLowerCase().trim();

    const phoneMap = new Map();
    const nameMap = new Map();

    for (const sub of allSubmissions) {
      const phone = (sub.phoneNumber || '').trim();
      if (phone && phone.length >= 7) {
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone).push(sub);
      }

      const hName = norm(sub.husbandName);
      const wName = norm(sub.wifeName);
      const sName = norm(sub.surname);
      if (hName && wName) {
        const nameKey = `${hName}__${wName}__${sName}`;
        if (!nameMap.has(nameKey)) nameMap.set(nameKey, []);
        nameMap.get(nameKey).push(sub);
      }
    }

    const groupMap = new Map(); // key -> group

    // Add phone duplicates
    for (const [phone, list] of phoneMap.entries()) {
      if (list.length > 1) {
        const groupKey = `phone-${phone}`;
        groupMap.set(groupKey, {
          id: groupKey,
          type: 'phone',
          conflictValue: phone,
          label: `Duplicate Phone Number: ${phone} (${list.length} entries)`,
          submissions: list
        });
      }
    }

    // Add name duplicates
    for (const [nameKey, list] of nameMap.entries()) {
      if (list.length > 1) {
        const first = list[0];
        const groupKey = `name-${nameKey}`;
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            id: groupKey,
            type: 'name',
            conflictValue: `${first.husbandName} & ${first.wifeName} ${first.surname}`,
            label: `Duplicate Names: ${first.husbandName} & ${first.wifeName} ${first.surname} (${list.length} entries)`,
            submissions: list
          });
        }
      }
    }

    const groups = Array.from(groupMap.values()).map(g => {
      return {
        ...g,
        submissions: g.submissions.map(sub => ({
          ...sub,
          couplePhoto: sub.hasCouplePhoto ? `/api/submissions/${sub.inquiryId}/photo` : null,
          paymentScreenshot: sub.hasPaymentScreenshot ? `/api/submissions/${sub.inquiryId}/screenshot` : null
        }))
      };
    });

    const sortedGroups = groups.sort((a, b) => {
      const maxA = Math.max(...a.submissions.map(s => new Date(s.createdAt || 0).getTime()));
      const maxB = Math.max(...b.submissions.map(s => new Date(s.createdAt || 0).getTime()));
      return maxB - maxA;
    });

    res.json(sortedGroups);
  } catch (err) {
    console.error('Error fetching duplicate submissions:', err);
    res.status(500).json({ error: 'Server error fetching duplicate submissions.' });
  }
});



// Stream couple photo endpoint
app.get('/api/submissions/:inquiryId/photo', async (req, res) => {
  try {
    const submission = await Submission.findOne({ $or: [{ inquiryId: req.params.inquiryId }, { oldInquiryId: req.params.inquiryId }] }, { couplePhoto: 1 });
    if (!submission || !submission.couplePhoto) {
      return res.status(404).send('Photo not found');
    }

    if (submission.couplePhoto.startsWith('http://') || submission.couplePhoto.startsWith('https://')) {
      try {
        const response = await fetch(submission.couplePhoto);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end(buffer);
      } catch (fetchErr) {
        console.error("Error streaming remote photo, redirecting instead:", fetchErr);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.redirect(submission.couplePhoto);
      }
    }

    const match = submission.couplePhoto.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const img = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': img.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end(img);
    } else {
      res.status(400).send('Invalid photo format');
    }
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Stream payment screenshot endpoint
app.get('/api/submissions/:inquiryId/screenshot', async (req, res) => {
  try {
    const submission = await Submission.findOne({ $or: [{ inquiryId: req.params.inquiryId }, { oldInquiryId: req.params.inquiryId }] }, { paymentScreenshot: 1 });
    if (!submission || !submission.paymentScreenshot) {
      return res.status(404).send('Screenshot not found');
    }

    if (submission.paymentScreenshot.startsWith('http://') || submission.paymentScreenshot.startsWith('https://')) {
      try {
        const response = await fetch(submission.paymentScreenshot);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const contentType = response.headers.get('content-type') || 'image/png';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end(buffer);
      } catch (fetchErr) {
        console.error("Error streaming remote screenshot, redirecting instead:", fetchErr);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.redirect(submission.paymentScreenshot);
      }
    }

    const match = submission.paymentScreenshot.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const img = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': img.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end(img);
    } else {
      res.status(400).send('Invalid screenshot format');
    }
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Verify login and retrieve role
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader === SUPER_ADMIN_PASSWORD) {
    res.json({ role: 'superadmin' });
  } else if (authHeader === ADMIN_PASSWORD) {
    res.json({ role: 'admin' });
  } else {
    res.status(401).json({ error: 'Invalid password.' });
  }
});

// Clear all data (Super Admin only)
app.post('/api/submissions/clear', requireSuperAuth, async (req, res) => {
  try {
    await Submission.deleteMany({});
    await Program.deleteMany({});
    await Counter.findOneAndUpdate({ name: 'inquiryNumber' }, { seq: 999 }, { upsert: true });



    res.json({ success: true, message: 'All registration data and uploads have been cleared successfully.' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Server error while clearing data.' });
  }
});

// Get payment settings (public)
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Setting.findOne({ key: 'main' });
    res.json(settings || { upiId: 'payee@upi', payeeName: 'Couple Pass', amount: '1500' });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching settings.' });
  }
});

// Update payment settings (Admin only)
app.post('/api/settings', requireAuth, async (req, res) => {
  const { upiId, payeeName, amount, upiIds, upiLimit } = req.body;
  if (!upiId || !payeeName || !amount) {
    return res.status(400).json({ error: 'UPI ID, Payee Name, and Amount are required.' });
  }
  try {
    let processedUpiIds = [upiId];
    if (Array.isArray(upiIds)) {
      processedUpiIds = upiIds.map(id => id.trim()).filter(Boolean);
    } else if (typeof upiIds === 'string') {
      processedUpiIds = upiIds.split(',').map(id => id.trim()).filter(Boolean);
    }
    if (processedUpiIds.length === 0) {
      processedUpiIds = [upiId];
    }

    const limitVal = parseInt(upiLimit, 10) || 50;

    const existing = await Setting.findOne({ key: 'main' });
    let resetCount = false;
    let newIndex = 0;

    if (existing) {
      const listChanged = JSON.stringify(existing.upiIds) !== JSON.stringify(processedUpiIds);
      if (listChanged) {
        const foundIndex = processedUpiIds.indexOf(upiId);
        newIndex = foundIndex !== -1 ? foundIndex : 0;
        resetCount = true;
      }
    }

    const updateObj = {
      upiId,
      payeeName,
      amount,
      upiIds: processedUpiIds,
      upiLimit: limitVal
    };

    if (resetCount || !existing) {
      updateObj.activeUpiIndex = newIndex;
      updateObj.upiBookingsCount = 0;
    }

    const settings = await Setting.findOneAndUpdate(
      { key: 'main' },
      updateObj,
      { new: true, upsert: true }
    );
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating settings.' });
  }
});

// Get notifications (Admin only)
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ isRead: false }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching notifications.' });
  }
});

// Dismiss notifications (Admin only)
app.post('/api/notifications/dismiss', requireAuth, async (req, res) => {
  const { id } = req.body;
  try {
    if (id) {
      await Notification.findByIdAndUpdate(id, { isRead: true });
    } else {
      await Notification.updateMany({ isRead: false }, { isRead: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error dismissing notifications.' });
  }
});

// Get all WhatsApp templates (Admin only)
app.get('/api/whatsapp-templates', requireAuth, async (req, res) => {
  try {
    const templates = await WhatsappTemplate.find({});
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching WhatsApp templates.' });
  }
});

// Create a new WhatsApp template (Admin only)
app.post('/api/whatsapp-templates', requireAuth, async (req, res) => {
  const { name, text, type } = req.body;
  if (!name || !text) {
    return res.status(400).json({ error: 'Template name and text are required.' });
  }
  const activeType = type || 'pass_delivery';
  try {
    const count = await WhatsappTemplate.countDocuments({ type: activeType });
    const isActive = count === 0;

    const newTemplate = await WhatsappTemplate.create({ name, text, type: activeType, isActive });
    res.status(201).json({ success: true, template: newTemplate });
  } catch (err) {
    res.status(500).json({ error: 'Server error creating WhatsApp template.' });
  }
});

// Set WhatsApp template as active (Admin only)
app.post('/api/whatsapp-templates/:id/use', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const target = await WhatsappTemplate.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'Template not found.' });
    }
    await WhatsappTemplate.updateMany({ type: target.type }, { isActive: false });
    target.isActive = true;
    await target.save();
    res.json({ success: true, message: 'WhatsApp template activated.', template: target });
  } catch (err) {
    res.status(500).json({ error: 'Server error activating WhatsApp template.' });
  }
});

// Delete a WhatsApp template (Admin only)
app.delete('/api/whatsapp-templates/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const template = await WhatsappTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found.' });
    }
    if (template.isActive) {
      return res.status(400).json({ error: 'Cannot delete the active template. Please set another template as active first.' });
    }
    await WhatsappTemplate.findByIdAndDelete(id);
    res.json({ success: true, message: 'WhatsApp template deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting WhatsApp template.' });
  }
});

// Get the active WhatsApp template (Public - used by registration page too)
app.get('/api/whatsapp-templates/active', async (req, res) => {
  const activeType = req.query.type || 'pass_delivery';
  try {
    const activeTemplate = await WhatsappTemplate.findOne({ type: activeType, isActive: true });
    if (!activeTemplate) {
      if (activeType === 'payment_request') {
        return res.json({ text: 'Hello! I have registered for the {programName}. My Inquiry ID is {inquiryId}. My phone number is {phoneNumber}. Please verify my payment screenshot.' });
      }
      return res.json({ text: 'Hello! Your payment has been verified. You can view and download your pass here: {passUrl}' });
    }
    res.json(activeTemplate);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching active WhatsApp template.' });
  }
});

// Database storage statistics (Admin only)
app.get('/api/db-status', requireAuth, async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    const dataSizeMB = (stats.dataSize / (1024 * 1024)).toFixed(2);
    const storageSizeMB = (stats.storageSize / (1024 * 1024)).toFixed(2);
    res.json({
      dataSizeMB: parseFloat(dataSizeMB),
      storageSizeMB: parseFloat(storageSizeMB),
      totalLimitMB: 512 // MongoDB Atlas Free Tier Limit
    });
  } catch (err) {
    console.error('Error fetching db stats:', err);
    res.status(500).json({ error: 'Server error fetching database stats.' });
  }
});

// Unauthenticated DB connection diagnostic endpoint
app.get('/api/debug-db', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };

    let testResult = 'Not run';
    let queryError = null;
    try {
      const p = await Program.findOne({}, { id: 1 }).maxTimeMS(2000);
      testResult = p ? `Found program: ${p.id}` : 'No programs found';
    } catch (e) {
      queryError = e.message;
    }

    res.json({
      mongooseState: states[state] || state,
      mongoUriConfigured: !!process.env.MONGO_URI,
      testResult,
      queryError,
      envUriLength: process.env.MONGO_URI ? process.env.MONGO_URI.length : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Function to run database backup
const runDatabaseBackup = async () => {
  try {
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    console.log('[Backup] Starting scheduled database backup...');
    const programs = await Program.find({});
    const submissions = await Submission.find({});

    const backupData = {
      timestamp: new Date().toISOString(),
      programs,
      submissions
    };

    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `backup_${dateStr}.json`;
    const filePath = path.join(backupsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`[Backup] Database backup saved successfully to ${filePath}`);

    // Cleanup backups older than 15 days
    const files = fs.readdirSync(backupsDir);
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith('backup_') && file.endsWith('.json')) {
        const fileFull = path.join(backupsDir, file);
        const stats = fs.statSync(fileFull);
        if (stats.mtimeMs < fifteenDaysAgo) {
          fs.unlinkSync(fileFull);
          console.log(`[Backup] Deleted old backup file: ${file}`);
        }
      }
    }
  } catch (err) {
    console.error('[Backup] Error running database backup:', err);
  }
};

// Schedule backup to run every evening at 10:00 PM (22:00)
// Cron syntax: minute hour day-of-month month day-of-week
cron.schedule('0 22 * * *', () => {
  console.log('[Backup] Cron triggered: Running evening database backup...');
  runDatabaseBackup();
});

// Run a backup once on startup (after 5s) to verify configuration
// setTimeout(() => {
//   console.log('[Backup] Running startup database backup...');
//   runDatabaseBackup();
// }, 5000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

