import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Setup Multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Database simulation (JSON file)
const DB_FILE = path.join(__dirname, 'submissions.json');
let submissions = [];
let nextInquiryNumber = 1001;

if (fs.existsSync(DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    submissions = data.submissions || [];
    nextInquiryNumber = data.nextInquiryNumber || 1001;
  } catch (err) {
    console.error('Error reading database file:', err);
  }
}

const saveDatabase = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ submissions, nextInquiryNumber }, null, 2));
  } catch (err) {
    console.error('Error saving database file:', err);
  }
};

const SETTINGS_FILE = path.join(__dirname, 'settings.json');
let settings = {
  upiId: 'payee@upi',
  payeeName: 'Couple Pass',
  amount: '100'
};

if (fs.existsSync(SETTINGS_FILE)) {
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading settings file:', err);
  }
}

const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error saving settings file:', err);
  }
};

const PROGRAMS_FILE = path.join(__dirname, 'programs.json');
let programs = [];

if (fs.existsSync(PROGRAMS_FILE)) {
  try {
    programs = JSON.parse(fs.readFileSync(PROGRAMS_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading programs database file:', err);
  }
}

const savePrograms = () => {
  try {
    fs.writeFileSync(PROGRAMS_FILE, JSON.stringify(programs, null, 2));
  } catch (err) {
    console.error('Error saving programs file:', err);
  }
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running successfully.' });
});

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

// Get all programs
app.get('/api/programs', (req, res) => {
  res.json(programs);
});

// Create a new program (Admin protected)
app.post('/api/programs', requireAuth, (req, res) => {
  const { name, date, capacity } = req.body;
  if (!name || !date || !capacity) {
    return res.status(400).json({ error: 'Name, date, and capacity are required.' });
  }
  const newProgram = {
    id: `prog-${Date.now()}`,
    name,
    date,
    capacity: parseInt(capacity, 10),
    bookingsCount: 0
  };
  programs.push(newProgram);
  savePrograms();
  res.status(201).json(newProgram);
});

// Delete a program (Admin protected)
app.delete('/api/programs/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = programs.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Program not found.' });
  }
  programs.splice(index, 1);
  savePrograms();
  res.json({ success: true, message: 'Program deleted successfully.' });
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

    // Find selected program and check capacity
    const program = programs.find(p => p.id === programId);
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
        const image = await Jimp.read(paymentScreenshotFile.path);
        const qrCode = jsQR(
          new Uint8ClampedArray(image.bitmap.data),
          image.bitmap.width,
          image.bitmap.height
        );
        if (qrCode && qrCode.data) {
          if (qrCode.data.includes('upi://pay')) {
            // Delete uploaded files to clean up
            fs.unlinkSync(couplePhotoFile.path);
            fs.unlinkSync(paymentScreenshotFile.path);
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
          paymentScreenshotFile.path,
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

        const hasKeyword = keywords.some(kw => text.includes(kw));
        if (!hasKeyword) {
          // Delete uploaded files to clean up
          fs.unlinkSync(couplePhotoFile.path);
          fs.unlinkSync(paymentScreenshotFile.path);
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

    const inquiryId = `INQ-${nextInquiryNumber++}`;

    // Increment bookings count by 2 (since it is a couple registration)
    program.bookingsCount += 2;
    savePrograms();

    const newSubmission = {
      inquiryId,
      husbandName,
      wifeName,
      surname,
      phoneNumber,
      programId,
      programName: program.name,
      programDate: program.date,
      couplePhoto: `/uploads/${couplePhotoFile.filename}`,
      paymentScreenshot: paymentScreenshotFile ? `/uploads/${paymentScreenshotFile.filename}` : null,
      payeeNameFromReceipt: req.payeeNameFromReceipt || 'Not detected',
      status: 'pending', // Default status is pending
      createdAt: new Date().toISOString()
    };

    submissions.push(newSubmission);
    saveDatabase();

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
app.post('/api/submissions/:inquiryId/approve', requireAuth, (req, res) => {
  const { inquiryId } = req.params;
  const submission = submissions.find(s => s.inquiryId === inquiryId);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found.' });
  }
  submission.status = 'approved';
  saveDatabase();
  res.json({ success: true, message: 'Submission approved successfully.', data: submission });
});

// Reject Submission (Admin protected)
app.post('/api/submissions/:inquiryId/reject', requireAuth, (req, res) => {
  const { inquiryId } = req.params;
  const { reason } = req.body;
  const submission = submissions.find(s => s.inquiryId === inquiryId);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found.' });
  }
  submission.status = 'rejected';
  submission.rejectionReason = reason || 'Payment verification failed.';
  saveDatabase();
  res.json({ success: true, message: 'Submission rejected.', data: submission });
});

// Public status check by Inquiry ID
app.get('/api/submissions/status/:inquiryId', (req, res) => {
  const { inquiryId } = req.params;
  const submission = submissions.find(s => s.inquiryId.toUpperCase() === inquiryId.toUpperCase());
  if (!submission) {
    return res.status(404).json({ error: 'Inquiry ID not found.' });
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
    couplePhoto: submission.couplePhoto,
    status: submission.status,
    rejectionReason: submission.rejectionReason
  });
});

// Get all submissions (for admin view/verification)
app.get('/api/submissions', requireAuth, (req, res) => {
  res.json(submissions);
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
app.post('/api/submissions/clear', requireSuperAuth, (req, res) => {
  try {
    submissions = [];
    nextInquiryNumber = 1001;
    saveDatabase();

    // Clear all programs/slots
    programs = [];
    savePrograms();

    // Clear uploads folder files
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }

    res.json({ success: true, message: 'All registration data and uploads have been cleared successfully.' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Server error while clearing data.' });
  }
});

// Get payment settings (public)
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

// Update payment settings (Admin only)
app.post('/api/settings', requireAuth, (req, res) => {
  const { upiId, payeeName, amount } = req.body;
  if (!upiId || !payeeName || !amount) {
    return res.status(400).json({ error: 'UPI ID, Payee Name, and Amount are required.' });
  }
  settings.upiId = upiId;
  settings.payeeName = payeeName;
  settings.amount = amount;
  saveSettings();
  res.json({ success: true, settings });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
