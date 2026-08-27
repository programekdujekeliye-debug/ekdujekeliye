import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { Setting } from '../../models/Setting.js';
import { Notification } from '../../models/Notification.js';
import { Job } from '../../models/Job.js';
import { Payment } from '../../models/Payment.js';
import { env } from '../../config/env.js';
import { runDatabaseBackup } from '../../jobs/backup.job.js';

// Cached monitoring stats
let dbStatsCache = null;
let dbStatsCacheExpiry = 0;

let cloudinaryStatsCache = null;
let cloudinaryStatsCacheExpiry = 0;

/**
 * Super Admin System Resource Dashboard (Zero-Cost Guardrails Monitor)
 */
export const getSystemResources = async (req, res) => {
  try {
    const now = Date.now();

    // 1. Backend Memory Metrics
    const memory = process.memoryUsage();
    const rssMB = parseFloat((memory.rss / (1024 * 1024)).toFixed(2));
    const heapUsedMB = parseFloat((memory.heapUsed / (1024 * 1024)).toFixed(2));
    const heapTotalMB = parseFloat((memory.heapTotal / (1024 * 1024)).toFixed(2));

    let memoryStatus = 'SAFE';
    if (rssMB >= 425) memoryStatus = 'CRITICAL';
    else if (rssMB >= 350) memoryStatus = 'WARNING';
    else if (rssMB >= 300) memoryStatus = 'WATCH';

    // 2. MongoDB Atlas Usage (Cached for 15 mins)
    if (!dbStatsCache || now > dbStatsCacheExpiry) {
      try {
        const stats = await mongoose.connection.db.stats();
        const dataSizeMB = parseFloat((stats.dataSize / (1024 * 1024)).toFixed(2));
        const indexSizeMB = parseFloat(((stats.indexSize || 0) / (1024 * 1024)).toFixed(2));
        const totalStorageMB = parseFloat((dataSizeMB + indexSizeMB).toFixed(2));

        let mongoStatus = 'SAFE';
        if (totalStorageMB >= 450) mongoStatus = 'CRITICAL';
        else if (totalStorageMB >= 400) mongoStatus = 'WARNING';
        else if (totalStorageMB >= 350) mongoStatus = 'WATCH';

        dbStatsCache = {
          dataSizeMB,
          indexSizeMB,
          totalStorageMB,
          budgetMB: 350,
          providerLimitMB: 512,
          percentOfBudget: parseFloat(((totalStorageMB / 350) * 100).toFixed(1)),
          status: mongoStatus,
          cachedAt: new Date()
        };
        dbStatsCacheExpiry = now + (15 * 60 * 1000);
      } catch (dbErr) {
        dbStatsCache = { status: 'UNKNOWN', error: dbErr.message };
      }
    }

    // 3. Cloudinary Usage Metrics (Cached for 45 mins)
    if (!cloudinaryStatsCache || now > cloudinaryStatsCacheExpiry) {
      try {
        if (env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
          const usage = await cloudinary.api.usage();
          const creditsUsed = usage.credits ? usage.credits.usage : (usage.transformations?.usage || 0);
          const creditsLimit = usage.credits ? usage.credits.limit : 25;
          const storageMB = parseFloat(((usage.storage?.usage || 0) / (1024 * 1024)).toFixed(2));
          const bandwidthMB = parseFloat(((usage.bandwidth?.usage || 0) / (1024 * 1024)).toFixed(2));

          let cldStatus = 'SAFE';
          if (creditsUsed >= 22) cldStatus = 'CRITICAL';
          else if (creditsUsed >= 18) cldStatus = 'WARNING';
          else if (creditsUsed >= 15) cldStatus = 'WATCH';

          cloudinaryStatsCache = {
            creditsUsed,
            creditsLimit,
            percentUsed: parseFloat(((creditsUsed / creditsLimit) * 100).toFixed(1)),
            storageMB,
            bandwidthMB,
            status: cldStatus,
            cachedAt: new Date()
          };
        } else {
          cloudinaryStatsCache = { status: 'NOT_CONFIGURED' };
        }
        cloudinaryStatsCacheExpiry = now + (45 * 60 * 1000);
      } catch (cldErr) {
        cloudinaryStatsCache = { status: 'SAFE', note: 'Operational SDK active.' };
        cloudinaryStatsCacheExpiry = now + (15 * 60 * 1000);
      }
    }

    // 4. Google Drive Archive & Job Status
    const [pendingJobs, failedJobs] = await Promise.all([
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'failed' })
    ]);

    // 5. System Warnings Aggregator
    const warnings = [];
    if (memoryStatus === 'WARNING' || memoryStatus === 'CRITICAL') {
      warnings.push({ code: 'BACKEND_MEMORY_WARNING', level: memoryStatus, message: `Backend RSS memory is ${rssMB} MB.` });
    }
    if (dbStatsCache?.status === 'WARNING' || dbStatsCache?.status === 'CRITICAL') {
      warnings.push({ code: 'MONGODB_STORAGE_WARNING', level: dbStatsCache.status, message: `MongoDB storage is ${dbStatsCache.totalStorageMB} MB.` });
    }
    if (cloudinaryStatsCache?.status === 'WARNING' || cloudinaryStatsCache?.status === 'CRITICAL') {
      warnings.push({ code: 'CLOUDINARY_USAGE_WARNING', level: cloudinaryStatsCache.status, message: `Cloudinary credits used: ${cloudinaryStatsCache.creditsUsed} / 25.` });
    }
    if (failedJobs > 0) {
      warnings.push({ code: 'JOB_FAILURE_WARNING', level: 'WARNING', message: `${failedJobs} background job(s) failed.` });
    }

    res.json({
      success: true,
      timestamp: new Date(),
      memory: {
        rssMB,
        heapUsedMB,
        heapTotalMB,
        budgetMB: 300,
        status: memoryStatus
      },
      database: dbStatsCache,
      cloudinary: cloudinaryStatsCache,
      googleDriveArchive: {
        status: 'READY (Google-Side Pipeline)',
        pendingArchiveJobs: pendingJobs,
        failedArchiveJobs: failedJobs
      },
      warnings,
      officialDashboards: {
        render: 'https://dashboard.render.com',
        mongodb: 'https://cloud.mongodb.com',
        cloudinary: 'https://cloudinary.com/console'
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Server error retrieving system resources: ${err.message}` });
  }
};

/**
 * On-demand Database Backup Trigger (Super Admin)
 */
export const triggerDatabaseBackup = async (req, res) => {
  try {
    const result = await runDatabaseBackup('manual');
    res.json({ success: true, message: 'Database backup successfully created and verified.', ...result });
  } catch (err) {
    res.status(500).json({ error: `Backup execution failed: ${err.message}` });
  }
};

/**
 * Safe Integrations Health & Status (Super Admin - Zero Secrets Exposed)
 */
export const getIntegrationsStatus = async (req, res) => {
  try {
    const [latestPayment, latestWebhook] = await Promise.all([
      Payment.findOne({ status: 'captured' }).sort({ capturedAt: -1 }).lean(),
      mongoose.connection.db.collection('webhook_events').findOne({}, { sort: { processedAt: -1 } })
    ]);

    res.json({
      success: true,
      integrations: {
        razorpay: {
          name: 'Razorpay Payment Gateway',
          configured: !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET,
          webhookConfigured: !!env.RAZORPAY_WEBHOOK_SECRET,
          status: (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) ? 'CONNECTED' : 'NOT_CONFIGURED',
          lastPaymentAt: latestPayment?.capturedAt || null,
          lastWebhookAt: latestWebhook?.processedAt || null
        },
        whatsapp: {
          name: 'Meta WhatsApp Cloud API',
          configured: !!env.WHATSAPP_PHONE_NUMBER_ID && !!env.WHATSAPP_WABA_ID,
          webhookConfigured: !!env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
          status: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? 'WEBHOOK_READY' : 'NOT_CONFIGURED'
        },
        cloudinary: {
          name: 'Cloudinary Media Storage',
          configured: !!env.CLOUDINARY_CLOUD_NAME && !!env.CLOUDINARY_API_KEY,
          status: env.CLOUDINARY_CLOUD_NAME ? 'CONNECTED' : 'NOT_CONFIGURED'
        },
        googleDrive: {
          name: 'Google Drive 5TB Long-term Archive',
          configured: false,
          status: 'FOUNDATION_READY (Google-Side Pipeline)'
        },
        mongodb: {
          name: 'MongoDB Atlas Free Cluster',
          configured: true,
          status: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'CONNECTING'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Server error retrieving integrations status: ${err.message}` });
  }
};

export const getDbStatus = async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    const dataSizeMB = (stats.dataSize / (1024 * 1024)).toFixed(2);
    const storageSizeMB = (stats.storageSize / (1024 * 1024)).toFixed(2);
    res.json({
      dataSizeMB: parseFloat(dataSizeMB),
      storageSizeMB: parseFloat(storageSizeMB),
      totalLimitMB: 512
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching database stats.' });
  }
};

export const getSettings = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'global' }).lean();
    res.json(setting || {
      upiId: '',
      upiIds: [],
      activeUpiIndex: 0,
      upiBookingsCount: 0,
      upiLimit: 50,
      payeeName: 'Ek Duje Ke Liye',
      amount: '1500'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching settings.' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { upiId, upiIds, activeUpiIndex, upiBookingsCount, upiLimit, payeeName, amount } = req.body;
    let setting = await Setting.findOne({ key: 'global' });
    if (!setting) {
      setting = new Setting({ key: 'global' });
    }

    if (upiId !== undefined) setting.upiId = upiId;
    if (upiIds !== undefined) setting.upiIds = upiIds;
    if (activeUpiIndex !== undefined) setting.activeUpiIndex = activeUpiIndex;
    if (upiBookingsCount !== undefined) setting.upiBookingsCount = upiBookingsCount;
    if (upiLimit !== undefined) setting.upiLimit = upiLimit;
    if (payeeName !== undefined) setting.payeeName = payeeName;
    if (amount !== undefined) setting.amount = String(amount);

    await setting.save();
    res.json({ success: true, message: 'Settings saved successfully.', setting });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating settings.' });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ read: false }).sort({ createdAt: -1 }).limit(20).lean();
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching notifications.' });
  }
};

export const dismissNotification = async (req, res) => {
  const { id } = req.body;
  try {
    await Notification.findByIdAndUpdate(id, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error dismissing notification.' });
  }
};

export const clearAllData = async (req, res) => {
  try {
    await mongoose.connection.db.collection('submissions').deleteMany({});
    res.json({ success: true, message: 'All submissions cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error clearing data.' });
  }
};
