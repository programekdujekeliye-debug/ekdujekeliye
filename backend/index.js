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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
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
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
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
});
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
});
const Submission = mongoose.model('Submission', SubmissionSchema);

const SettingSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  upiId: { type: String, default: 'payee@upi' },
  payeeName: { type: String, default: 'Couple Pass' },
  amount: { type: String, default: '100' }
});
const Setting = mongoose.model('Setting', SettingSchema);

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 999 }
});
const Counter = mongoose.model('Counter', CounterSchema);

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

// Get all programs
app.get('/api/programs', async (req, res) => {
  try {
    const programs = await Program.find();
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching programs.' });
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

    // Validate if the uploaded payment screenshot is actually the QR code itself
    if (paymentScreenshotFile) {
      try {
        const image = await Jimp.read(paymentScreenshotFile.buffer);
        const qrCode = jsQR(
          new Uint8ClampedArray(image.bitmap.data),
          image.bitmap.width,
          image.bitmap.height
        );
        if (qrCode && qrCode.data) {
          if (qrCode.data.includes('upi://pay')) {
            return res.status(400).json({
              error: 'તમે પેમેન્ટનો QR કોડ અપલોડ કર્યો છે. કૃપા કરીને પેમેન્ટ થયા પછીનો સક્સેસ સ્ક્રીનશોટ (Receipt) અપલોડ કરો!'
            });
          }
        }
      } catch (qrErr) {
        console.error('Error scanning QR code in screenshot:', qrErr);
      }

      let payeeNameFromReceipt = 'Not detected';
      // OCR check: scan text to see if it contains transaction-related keywords
      try {
        const ocrResult = await Tesseract.recognize(
          paymentScreenshotFile.buffer,
          'eng'
        );
        const originalText = ocrResult.data.text;
        const text = originalText.toLowerCase();

        // Keywords typical for GPAY, Paytm, PhonePe, BHIM, Bank transfer receipts
        const keywords = [
          'success', 'successful', 'paid', 'payment', 'transferred', 'completed',
          'utr', 'txn', 'transaction', 'ref', 'gpay', 'phonepe', 'paytm', 'bhim',
          'sent', 'upi', 'to:', 'from:', 'rs', 'received', 'debit', 'credit'
        ];

        const hasKeyword = keywords.some(kw => {
          const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          // Enforce word boundary for short keywords to prevent false positives (e.g. 'rs' matching 'years')
          if (kw.length <= 3 || kw.endsWith(':')) {
            const regex = new RegExp(`\\b${escaped}`, 'i');
            return regex.test(text);
          }
          return text.includes(kw);
        });

        if (!hasKeyword) {
          return res.status(400).json({
            error: 'અપલોડ કરેલી ઈમેજ પેમેન્ટ રિસીપ્ટ કે કન્ફર્મેશન સ્ક્રીનશોટ નથી. કૃપા કરીને સાચો સક્સેસ સ્ક્રીનશોટ (Receipt) અપલોડ કરો!'
          });
        }

        // Try to extract who was paid
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
      } catch (ocrErr) {
        console.error('OCR validation error:', ocrErr);
        // Do not block if OCR library fails internally to avoid breaking registration
      }

      req.payeeNameFromReceipt = payeeNameFromReceipt;
    }

    const nextSeq = await getNextInquiryNumber();
    const inquiryId = `CPL-${nextSeq}`;

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
      couplePhoto: `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`,
      paymentScreenshot: paymentScreenshotFile ? `data:${paymentScreenshotFile.mimetype};base64,${paymentScreenshotFile.buffer.toString('base64')}` : null,
      payeeNameFromReceipt: req.payeeNameFromReceipt || 'Not detected',
      status: 'pending', // Default status is pending
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: newSubmission
    });

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

    // Handle photo updates (Base64 conversion)
    const couplePhotoFile = req.files && req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;
    const paymentScreenshotFile = req.files && req.files['paymentScreenshot'] ? req.files['paymentScreenshot'][0] : null;

    if (couplePhotoFile) {
      submission.couplePhoto = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
    }

    if (paymentScreenshotFile) {
      submission.paymentScreenshot = `data:${paymentScreenshotFile.mimetype};base64,${paymentScreenshotFile.buffer.toString('base64')}`;
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

// Get all submissions (for admin view/verification)
app.get('/api/submissions', requireAuth, async (req, res) => {
  try {
    const submissions = await Submission.find();
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching submissions.' });
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
