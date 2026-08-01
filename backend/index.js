import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
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
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins dynamically to support credentials: true
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Setup Multer for memory storage (avoids ephemeral disk deletion on Render)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// MongoDB Connection
const MONGO_URI = (process.env.MONGO_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority').trim();
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB database.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Database Schemas & Models
const ProgramSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, default: "8:30 PM" },
  capacity: { type: Number, required: true },
  bookingsCount: { type: Number, default: 0 },
  cardTemplate: { type: String },
  heartX: { type: Number, default: 144 },
  heartY: { type: Number, default: 112 },
  heartWidth: { type: Number, default: 288 },
  heartHeight: { type: Number, default: 260 },
  photoZoom: { type: Number, default: 1.0 },
  photoOffsetY: { type: Number, default: 0 }
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
  createdAt: { type: Date, default: Date.now }
}, { collection: 'submission' });
SubmissionSchema.index({ createdAt: -1 });
const Submission = mongoose.model('Submission', SubmissionSchema);

const SettingSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  upiId: { type: String, default: 'payee@upi' },
  payeeName: { type: String, default: 'Couple Pass' },
  amount: { type: String, default: '100' }
}, { collection: 'setting' });
const Setting = mongoose.model('Setting', SettingSchema);

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 999 }
}, { collection: 'counter' });
const Counter = mongoose.model('Counter', CounterSchema);

const WhatsappTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['pass_delivery', 'payment_request'], default: 'pass_delivery' },
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

// Initialize Settings
const initSettings = async () => {
  try {
    const existing = await Setting.findOne({ key: 'main' });
    if (!existing) {
      await Setting.create({ key: 'main', upiId: 'payee@upi', payeeName: 'Couple Pass', amount: '100' });
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

// Get all programs (optimized to exclude heavy cardTemplate by default to speed up slot selection)
app.get('/api/programs', async (req, res) => {
  try {
    const programs = await Program.find({}, { cardTemplate: 0 });
    
    // Map programs to include absolute URL path for cardTemplate instead of base64
    const host = req.get('host');
    const protocol = req.protocol;
    const mapped = programs.map(p => {
      const obj = p.toObject();
      obj.cardTemplate = p.cardTemplate !== null ? `${protocol}://${host}/api/programs/${p.id}/template` : null;
      return obj;
    });
    
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching programs.' });
  }
});

// Stream program card template endpoint
app.get('/api/programs/:id/template', async (req, res) => {
  try {
    const program = await Program.findOne({ id: req.params.id }, { cardTemplate: 1 });
    if (!program || !program.cardTemplate) {
      return res.status(404).send('Template not found');
    }
    
    const match = program.cardTemplate.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const img = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': img.length,
        'Cache-Control': 'public, max-age=86400' // cache for 1 day
      });
      res.end(img);
    } else {
      res.status(400).send('Invalid template format');
    }
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Create a new program (Admin protected)
app.post('/api/programs', requireAuth, async (req, res) => {
  const { name, date, time, capacity, cardTemplate, heartX, heartY, heartWidth, heartHeight, photoZoom, photoOffsetY } = req.body;
  if (!name || !date || !capacity) {
    return res.status(400).json({ error: 'Name, date, and capacity are required.' });
  }
  try {
    const newProgram = await Program.create({
      id: `prog-${Date.now()}`,
      name,
      date,
      time: time || '8:30 PM',
      capacity: parseInt(capacity, 10),
      bookingsCount: 0,
      cardTemplate,
      heartX: heartX !== undefined ? parseInt(heartX, 10) : 144,
      heartY: heartY !== undefined ? parseInt(heartY, 10) : 112,
      heartWidth: heartWidth !== undefined ? parseInt(heartWidth, 10) : 288,
      heartHeight: heartHeight !== undefined ? parseInt(heartHeight, 10) : 260,
      photoZoom: photoZoom !== undefined ? parseFloat(photoZoom) : 1.0,
      photoOffsetY: photoOffsetY !== undefined ? parseInt(photoOffsetY, 10) : 0
    });
    res.status(201).json(newProgram);
  } catch (err) {
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
    res.json({ success: true, message: 'Program deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting program.' });
  }
});

// Update a program (Admin protected)
app.put('/api/programs/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, date, time, capacity, cardTemplate, heartX, heartY, heartWidth, heartHeight, photoZoom, photoOffsetY } = req.body;
  try {
    const program = await Program.findOne({ id });
    if (!program) {
      return res.status(404).json({ error: 'Program not found.' });
    }

    if (name) program.name = name;
    if (date) program.date = date;
    if (time !== undefined) program.time = time;
    if (capacity) program.capacity = parseInt(capacity, 10);
    if (cardTemplate !== undefined) program.cardTemplate = cardTemplate;
    if (heartX !== undefined) program.heartX = parseInt(heartX, 10);
    if (heartY !== undefined) program.heartY = parseInt(heartY, 10);
    if (heartWidth !== undefined) program.heartWidth = parseInt(heartWidth, 10);
    if (heartHeight !== undefined) program.heartHeight = parseInt(heartHeight, 10);
    if (photoZoom !== undefined) program.photoZoom = parseFloat(photoZoom);
    if (photoOffsetY !== undefined) program.photoOffsetY = parseInt(photoOffsetY, 10);

    await program.save();
    res.json({ success: true, message: 'Program updated successfully.', data: program });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating program.' });
  }
});

// Submit Form
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

    // Check if phone number is already registered (excluding rejected ones)
    const existingRegistration = await Submission.findOne({ phoneNumber, status: { $ne: 'rejected' } });
    if (existingRegistration) {
      return res.status(400).json({ error: 'આ મોબાઇલ નંબર પરથી રજીસ્ટ્રેશન પહેલેથી જ થઈ ગયું છે!' });
    }

    // Find selected program and check capacity
    const program = await Program.findOne({ id: programId });
    if (!program) {
      return res.status(400).json({ error: 'Invalid program/slot selected' });
    }

    if (program.bookingsCount + 2 > program.capacity) {
      return res.status(400).json({ error: 'This program slot is sold out (not enough seats left for a couple).' });
    }

    const couplePhotoFile = req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;
    const paymentScreenshotFile = req.files['paymentScreenshot'] ? req.files['paymentScreenshot'][0] : null;

    if (!couplePhotoFile) {
      return res.status(400).json({ error: 'Couple photo is required' });
    }

    const nextSeq = await getNextInquiryNumber();
    const inquiryId = `CPL-${nextSeq}`;

    // Upload files to Cloudinary
    const couplePhotoBase64 = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
    const couplePhotoUrl = await uploadToCloudinary(couplePhotoBase64, 'couplePhotos');

    let paymentScreenshotUrl = null;
    if (paymentScreenshotFile) {
      const paymentScreenshotBase64 = `data:${paymentScreenshotFile.mimetype};base64,${paymentScreenshotFile.buffer.toString('base64')}`;
      paymentScreenshotUrl = await uploadToCloudinary(paymentScreenshotBase64, 'paymentScreenshots');
    }

    // Increment bookings count by 2 (since it is a couple registration)
    program.bookingsCount += 2;
    await program.save();

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
      paymentScreenshot: paymentScreenshotUrl,
      payeeNameFromReceipt: paymentScreenshotFile ? 'Processing...' : 'No payment file',
      status: 'pending', // Default status is pending
      createdAt: new Date()
    });

    // Send instant response to client
    res.status(201).json({
      success: true,
      data: newSubmission
    });

    // Run heavy QR scan and Tesseract OCR text recognition asynchronously in the background
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
    res.status(500).json({ error: 'Server error processing submission' });
  }
});

// Approve Submission (Admin protected)
app.post('/api/submissions/:inquiryId/approve', requireAuth, async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const submission = await Submission.findOneAndUpdate(
      { inquiryId },
      { status: 'approved' },
      { new: true }
    );
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
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
    const submission = await Submission.findOneAndUpdate(
      { inquiryId },
      { status: 'rejected', rejectionReason: reason || 'Payment verification failed.' },
      { new: true }
    );
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    res.json({ success: true, message: 'Submission rejected.', data: submission });
  } catch (err) {
    res.status(500).json({ error: 'Server error rejecting submission.' });
  }
});

// Delete a single submission (Admin only)
app.delete('/api/submissions/:inquiryId', requireAuth, async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    // Release bookings (seats) in the program
    if (submission.programId) {
      const program = await Program.findOne({ id: submission.programId });
      if (program) {
        program.bookingsCount = Math.max(0, program.bookingsCount - 2);
        await program.save();
      }
    }

    // Delete submission document
    await Submission.deleteOne({ inquiryId });

    res.json({ success: true, message: `Submission ${inquiryId} deleted successfully, and bookings released.` });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Server error while deleting submission.' });
  }
});

// Bulk delete submissions (Admin only)
app.post('/api/submissions/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { inquiryIds } = req.body;
    if (!Array.isArray(inquiryIds) || inquiryIds.length === 0) {
      return res.status(400).json({ error: 'No inquiry IDs provided.' });
    }

    const submissions = await Submission.find({ inquiryId: { $in: inquiryIds } });
    
    // Decrement bookingsCount for each program slot
    for (const sub of submissions) {
      if (sub.programId) {
        const program = await Program.findOne({ id: sub.programId });
        if (program) {
          program.bookingsCount = Math.max(0, program.bookingsCount - 2);
          await program.save();
        }
      }
    }

    // Delete submission documents
    await Submission.deleteMany({ inquiryId: { $in: inquiryIds } });

    res.json({ success: true, message: `${submissions.length} submissions deleted successfully, and bookings released.` });
  } catch (error) {
    console.error('Error bulk deleting submissions:', error);
    res.status(500).json({ error: 'Server error while bulk deleting submissions.' });
  }
});


// Edit a registration submission (Admin only)
app.put('/api/submissions/:inquiryId', requireAuth, upload.fields([
  { name: 'couplePhoto', maxCount: 1 },
  { name: 'paymentScreenshot', maxCount: 1 }
]), async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { husbandName, wifeName, surname, phoneNumber, programId, photoZoom, photoOffsetY } = req.body;

    const submission = await Submission.findOne({ inquiryId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    // Update simple fields
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

    // Handle program/slot changes
    if (programId && programId !== submission.programId) {
      const newProgram = await Program.findOne({ id: programId });
      if (!newProgram) {
        return res.status(400).json({ error: 'Invalid program slot selected.' });
      }

      // Check capacity in the new program
      if (newProgram.bookingsCount + 2 > newProgram.capacity) {
        return res.status(400).json({ error: 'Selected program slot is sold out.' });
      }

      // Release seats from old program
      if (submission.programId) {
        const oldProgram = await Program.findOne({ id: submission.programId });
        if (oldProgram) {
          oldProgram.bookingsCount = Math.max(0, oldProgram.bookingsCount - 2);
          await oldProgram.save();
        }
      }

      // Book seats in the new program
      newProgram.bookingsCount += 2;
      await newProgram.save();

      submission.programId = programId;
      submission.programName = newProgram.name;
      submission.programDate = newProgram.date;
      submission.programTime = newProgram.time || "8:30 PM";
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
    const submission = await Submission.findOne({ inquiryId: new RegExp(`^${inquiryId}$`, 'i') });
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

    if (submission.programId) {
      const program = await Program.findOne({ id: submission.programId });
      if (program) {
        if (program.cardTemplate) cardTemplate = program.cardTemplate;
        if (program.heartX !== undefined) heartX = program.heartX;
        if (program.heartY !== undefined) heartY = program.heartY;
        if (program.heartWidth !== undefined) heartWidth = program.heartWidth;
        if (program.heartHeight !== undefined) heartHeight = program.heartHeight;
        if (program.photoZoom !== undefined) photoZoom = program.photoZoom;
        if (program.photoOffsetY !== undefined) photoOffsetY = program.photoOffsetY;
        if (program.time) programTime = program.time;
      }
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
      couplePhoto: submission.couplePhoto,
      status: submission.status,
      rejectionReason: submission.rejectionReason,
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

    const { programId, status } = req.query;
    const query = {};
    if (programId) query.programId = programId;
    if (status) query.status = status;

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

    let filter = {};
    if (search) {
      const trimmedSearch = search.trim();
      const isExactToken = /^cpl-\d+$/i.test(trimmedSearch);
      if (isExactToken) {
        filter.inquiryId = { $regex: new RegExp(`^${trimmedSearch}$`, 'i') };
      } else {
        const searchRegex = new RegExp(trimmedSearch, 'i');
        filter.$or = [
          { inquiryId: searchRegex },
          { husbandName: searchRegex },
          { wifeName: searchRegex },
          { surname: searchRegex },
          { phoneNumber: searchRegex }
        ];
      }
    }
    if (status) {
      filter.status = status;
    }
    if (programId) {
      filter.programId = programId;
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
      rejectionReason: 1,
      createdAt: 1,
      couplePhoto: 1,
      paymentScreenshot: 1
    }, { allowDiskUse: true })
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit);

    // Map submissions to include direct Cloudinary URLs or fallback to local path
    const mappedSubmissions = submissions.map(sub => {
      const obj = sub.toObject();
      
      if (sub.couplePhoto) {
        if (sub.couplePhoto.startsWith('http://') || sub.couplePhoto.startsWith('https://')) {
          obj.couplePhoto = sub.couplePhoto;
        } else {
          obj.couplePhoto = `/api/submissions/${sub.inquiryId}/photo`;
        }
      } else {
        obj.couplePhoto = null;
      }

      if (sub.paymentScreenshot) {
        if (sub.paymentScreenshot.startsWith('http://') || sub.paymentScreenshot.startsWith('https://')) {
          obj.paymentScreenshot = sub.paymentScreenshot;
        } else {
          obj.paymentScreenshot = `/api/submissions/${sub.inquiryId}/screenshot`;
        }
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

// Get duplicate submissions grouped by conflict type (phone or name)
app.get('/api/submissions/duplicates', requireAuth, async (req, res) => {
  try {
    const allSubmissions = await Submission.find({});
    
    const norm = (str) => (str || '').toLowerCase().trim();
    
    const mapUrls = (sub) => {
      const obj = sub.toObject ? sub.toObject() : { ...sub };
      if (obj.couplePhoto) {
        if (obj.couplePhoto.startsWith('http://') || obj.couplePhoto.startsWith('https://')) {
          obj.couplePhoto = obj.couplePhoto;
        } else {
          obj.couplePhoto = `/api/submissions/${obj.inquiryId}/photo`;
        }
      } else {
        obj.couplePhoto = null;
      }

      if (obj.paymentScreenshot) {
        if (obj.paymentScreenshot.startsWith('http://') || obj.paymentScreenshot.startsWith('https://')) {
          obj.paymentScreenshot = obj.paymentScreenshot;
        } else {
          obj.paymentScreenshot = `/api/submissions/${obj.inquiryId}/screenshot`;
        }
      } else {
        obj.paymentScreenshot = null;
      }
      return obj;
    };

    const groups = [];
    const visited = new Set();
    
    for (let i = 0; i < allSubmissions.length; i++) {
      const subA = allSubmissions[i];
      if (visited.has(subA.inquiryId)) continue;
      
      const conflictGroup = [subA];
      const queue = [subA];
      visited.add(subA.inquiryId);
      
      while (queue.length > 0) {
        const current = queue.shift();
        
        for (let j = 0; j < allSubmissions.length; j++) {
          const subB = allSubmissions[j];
          if (visited.has(subB.inquiryId)) continue;
          
          const phoneMatch = current.phoneNumber && subB.phoneNumber && (current.phoneNumber.trim() === subB.phoneNumber.trim());
          const nameMatch = current.husbandName && subB.husbandName &&
                            current.wifeName && subB.wifeName &&
                            current.surname && subB.surname &&
                            (norm(current.husbandName) === norm(subB.husbandName)) &&
                            (norm(current.wifeName) === norm(subB.wifeName)) &&
                            (norm(current.surname) === norm(subB.surname));
                            
          if (phoneMatch || nameMatch) {
            conflictGroup.push(subB);
            queue.push(subB);
            visited.add(subB.inquiryId);
          }
        }
      }
      
      if (conflictGroup.length > 1) {
        let hasPhoneMatch = false;
        let hasNameMatch = false;
        
        for (let x = 0; x < conflictGroup.length; x++) {
          for (let y = x + 1; y < conflictGroup.length; y++) {
            const subX = conflictGroup[x];
            const subY = conflictGroup[y];
            
            if (subX.phoneNumber && subY.phoneNumber && subX.phoneNumber.trim() === subY.phoneNumber.trim()) {
              hasPhoneMatch = true;
            }
            if (norm(subX.husbandName) === norm(subY.husbandName) &&
                norm(subX.wifeName) === norm(subY.wifeName) &&
                norm(subX.surname) === norm(subY.surname)) {
              hasNameMatch = true;
            }
          }
        }
        
        let type = 'both';
        let label = '';
        if (hasPhoneMatch && hasNameMatch) {
          type = 'both';
          label = `Duplicate Phone & Names: ${conflictGroup[0].husbandName} & ${conflictGroup[0].wifeName} ${conflictGroup[0].surname} (${conflictGroup[0].phoneNumber})`;
        } else if (hasPhoneMatch) {
          type = 'phone';
          label = `Duplicate Phone Number: ${conflictGroup[0].phoneNumber}`;
        } else {
          type = 'name';
          label = `Duplicate Names: ${conflictGroup[0].husbandName} & ${conflictGroup[0].wifeName} ${conflictGroup[0].surname}`;
        }
        
        groups.push({
          id: `conflict-${conflictGroup[0].inquiryId}`,
          type,
          conflictValue: conflictGroup[0].phoneNumber,
          label,
          submissions: conflictGroup.map(mapUrls)
        });
      }
    }

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
    const submission = await Submission.findOne({ inquiryId: req.params.inquiryId }, { couplePhoto: 1 });
    if (!submission || !submission.couplePhoto) {
      return res.status(404).send('Photo not found');
    }

    if (submission.couplePhoto.startsWith('http://') || submission.couplePhoto.startsWith('https://')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.redirect(submission.couplePhoto);
    }

    const match = submission.couplePhoto.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const img = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': img.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
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
    const submission = await Submission.findOne({ inquiryId: req.params.inquiryId }, { paymentScreenshot: 1 });
    if (!submission || !submission.paymentScreenshot) {
      return res.status(404).send('Screenshot not found');
    }

    if (submission.paymentScreenshot.startsWith('http://') || submission.paymentScreenshot.startsWith('https://')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.redirect(submission.paymentScreenshot);
    }

    const match = submission.paymentScreenshot.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const img = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': img.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
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
    res.json(settings || { upiId: 'payee@upi', payeeName: 'Couple Pass', amount: '100' });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching settings.' });
  }
});

// Update payment settings (Admin only)
app.post('/api/settings', requireAuth, async (req, res) => {
  const { upiId, payeeName, amount } = req.body;
  if (!upiId || !payeeName || !amount) {
    return res.status(400).json({ error: 'UPI ID, Payee Name, and Amount are required.' });
  }
  try {
    const settings = await Setting.findOneAndUpdate(
      { key: 'main' },
      { upiId, payeeName, amount },
      { new: true, upsert: true }
    );
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating settings.' });
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
setTimeout(() => {
  console.log('[Backup] Running startup database backup...');
  runDatabaseBackup();
}, 5000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

