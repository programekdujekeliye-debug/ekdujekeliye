import mongoose from 'mongoose';
import { MediaArchive } from '../../models/MediaArchive.js';
import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { mediaService } from '../media/media.service.js';

/**
 * ==========================================================
 * HELPER: Recalculate and update Event archive progress stats
 * ==========================================================
 */
export const updateEventArchiveProgress = async (eventId) => {
  try {
    const event = await Event.findOne({
      $or: [{ id: eventId }, { slug: eventId }]
    });
    if (!event) return null;

    const actualEventId = event.id;

    const [submissionsCount, archiveStatsList] = await Promise.all([
      Registration.countDocuments({
        programId: actualEventId,
        isDeleted: { $ne: true },
        couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
      }),
      MediaArchive.aggregate([
        { $match: { eventId: actualEventId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalBytes: { $sum: '$originalSize' }
          }
        }
      ])
    ]);

    let verified = 0;
    let queued = 0;
    let copying = 0;
    let failed = 0;
    let totalBytes = 0;

    archiveStatsList.forEach(a => {
      const st = a._id;
      const cnt = a.count || 0;
      const bytes = a.totalBytes || 0;

      if (st === 'VERIFIED' || st === 'ARCHIVED' || st === 'DELETE_PENDING') {
        verified += cnt;
        totalBytes += bytes;
      } else if (st === 'QUEUED') {
        queued += cnt;
      } else if (st === 'COPYING') {
        copying += cnt;
      } else if (st === 'FAILED') {
        failed += cnt;
      }
    });

    const totalEligible = submissionsCount;

    event.archiveStats = {
      totalAssets: totalEligible,
      queuedAssets: queued,
      copyingAssets: copying,
      archivedAssets: verified,
      failedAssets: failed,
      totalBytes,
      lastWorkerAt: event.archiveStats?.lastWorkerAt || null
    };

    // Auto-detect completion or partial completion when active
    if (event.archiveStatus === 'ARCHIVING') {
      if (queued === 0 && copying === 0) {
        if (failed === 0 && verified >= totalEligible && totalEligible > 0) {
          event.archiveStatus = 'COMPLETED';
          event.archiveCompletedAt = new Date();
        } else if (failed > 0) {
          event.archiveStatus = 'PARTIAL';
        }
      }
    }

    await event.save();
    return event;
  } catch (err) {
    console.error(`[Archive Progress Error] ${err.message}`);
    return null;
  }
};

/**
 * ==========================================================
 * 1. GOOGLE-SIDE WORKER APIS (Bearer <ARCHIVE_WORKER_SECRET>)
 * ==========================================================
 */

/**
 * Non-mutating health check endpoint for Google Apps Script Worker
 */
export const archiveHealth = async (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    archiveWorker: 'ready',
    capabilities: {
      claimBatch: true,
      claimOne: true,
      claimEventBatch: true,
      claimActiveEventBatch: true,
      verifyItem: true,
      failItem: true
    }
  });
};

/**
 * Worker automatically claims a batch from the ONE currently active ARCHIVING event.
 * If no event is in ARCHIVING state, returns count: 0 (safe idle state).
 * Never claims queued jobs belonging to any other event.
 */
export const claimActiveEventBatch = async (req, res) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.body.limit || req.query.limit || '12', 10)), 50);
    const workerId = req.body.workerId || req.query.workerId || 'gas-auto-worker';
    const now = new Date();
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 mins stale timeout

    // 1. Locate the single active event currently in ARCHIVING status
    const activeEvent = await Event.findOne({ archiveStatus: 'ARCHIVING' }).lean();

    if (!activeEvent) {
      return res.json({
        success: true,
        activeEvent: null,
        count: 0,
        jobs: [],
        message: 'No active event archive currently in progress.'
      });
    }

    // 2. Atomically find and claim jobs strictly belonging to this active event
    const jobs = await MediaArchive.find({
      eventId: activeEvent.id,
      $or: [
        { status: 'QUEUED' },
        {
          status: 'COPYING',
          claimedAt: { $lt: staleThreshold },
          driveFileId: { $in: [null, ''] },
          verifiedAt: { $in: [null, ''] }
        }
      ]
    })
      .sort({ queuedAt: 1 })
      .limit(limit)
      .lean();

    if (jobs.length === 0) {
      // Recheck completion
      await updateEventArchiveProgress(activeEvent.id);
      return res.json({
        success: true,
        activeEvent: { id: activeEvent.id, name: activeEvent.name, slug: activeEvent.slug },
        count: 0,
        jobs: [],
        message: 'No queued jobs remaining for active event.'
      });
    }

    const jobIds = jobs.map(j => j._id);

    await MediaArchive.updateMany(
      { _id: { $in: jobIds } },
      {
        $set: {
          status: 'COPYING',
          workerId,
          claimedAt: now
        },
        $inc: { attempts: 1 }
      }
    );

    // Update last worker heartbeat on Event
    await Event.updateOne(
      { id: activeEvent.id },
      { $set: { 'archiveStats.lastWorkerAt': now } }
    );

    // Format lightweight metadata batch for Google Apps Script
    const formattedJobs = jobs.map(job => ({
      jobId: job._id.toString(),
      eventId: job.eventId,
      registrationId: job.registrationId,
      mediaType: job.mediaType,
      sourceUrl: job.sourceUrl,
      filename: job.filename,
      mimeType: job.mimeType || 'image/jpeg',
      folderPath: job.driveFolderPath || `Ek Duje Ke Liye/Events/${job.eventId}/Couple Photos`
    }));

    res.json({
      success: true,
      activeEvent: { id: activeEvent.id, name: activeEvent.name, slug: activeEvent.slug },
      count: formattedJobs.length,
      jobs: formattedJobs
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to claim active event batch: ${err.message}` });
  }
};

/**
 * Atomically claims exactly ONE specified archive job by jobId (for targeted single-photo tests)
 */
export const claimSingleArchiveJob = async (req, res) => {
  try {
    const { jobId } = req.body;
    const workerId = req.body.workerId || 'gas-single-worker';
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required.' });
    }

    const job = await MediaArchive.findOne({
      _id: jobId,
      status: 'QUEUED'
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found or not in QUEUED status.' });
    }

    job.status = 'COPYING';
    job.workerId = workerId;
    job.claimedAt = new Date();
    job.attempts = (job.attempts || 0) + 1;
    await job.save();

    const formattedJob = {
      jobId: job._id.toString(),
      eventId: job.eventId,
      registrationId: job.registrationId,
      mediaType: job.mediaType,
      sourceUrl: job.sourceUrl,
      filename: job.filename,
      mimeType: job.mimeType || 'image/jpeg',
      folderPath: job.driveFolderPath || `Ek Duje Ke Liye/Events/${job.eventId}/Couple Photos`
    };

    res.json({
      success: true,
      job: formattedJob
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to claim single job: ${err.message}` });
  }
};

/**
 * Atomically claims a batch of queued archive jobs STRICTLY for a specific eventId
 */
export const claimEventArchiveBatch = async (req, res) => {
  try {
    const eventId = req.body.eventId || req.query.eventId;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required to claim event-scoped archive batch.' });
    }

    const limit = Math.min(Math.max(1, parseInt(req.body.limit || req.query.limit || '15', 10)), 50);
    const workerId = req.body.workerId || req.query.workerId || 'gas-event-worker';
    const now = new Date();
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);

    const jobs = await MediaArchive.find({
      eventId,
      $or: [
        { status: 'QUEUED' },
        {
          status: 'COPYING',
          claimedAt: { $lt: staleThreshold },
          driveFileId: { $in: [null, ''] },
          verifiedAt: { $in: [null, ''] }
        }
      ]
    })
      .sort({ queuedAt: 1 })
      .limit(limit)
      .lean();

    if (jobs.length === 0) {
      return res.json({ success: true, count: 0, eventId, jobs: [] });
    }

    const jobIds = jobs.map(j => j._id);

    await MediaArchive.updateMany(
      { _id: { $in: jobIds } },
      {
        $set: {
          status: 'COPYING',
          workerId,
          claimedAt: now
        },
        $inc: { attempts: 1 }
      }
    );

    const formattedJobs = jobs.map(job => ({
      jobId: job._id.toString(),
      eventId: job.eventId,
      registrationId: job.registrationId,
      mediaType: job.mediaType,
      sourceUrl: job.sourceUrl,
      filename: job.filename,
      mimeType: job.mimeType || 'image/jpeg',
      folderPath: job.driveFolderPath || `Ek Duje Ke Liye/Events/${job.eventId}/Couple Photos`
    }));

    res.json({
      success: true,
      count: formattedJobs.length,
      eventId,
      jobs: formattedJobs
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to claim event archive batch: ${err.message}` });
  }
};

/**
 * Atomically claims a batch of queued archive jobs for Google Apps Script
 */
export const claimArchiveBatch = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || req.body.limit || '15', 10), 50);
    const workerId = req.body.workerId || req.query.workerId || 'gas-worker-1';
    const now = new Date();
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);

    const jobs = await MediaArchive.find({
      $or: [
        { status: 'QUEUED' },
        {
          status: 'COPYING',
          claimedAt: { $lt: staleThreshold },
          driveFileId: { $in: [null, ''] },
          verifiedAt: { $in: [null, ''] }
        }
      ]
    })
      .sort({ queuedAt: 1 })
      .limit(limit)
      .lean();

    if (jobs.length === 0) {
      return res.json({ success: true, count: 0, jobs: [] });
    }

    const jobIds = jobs.map(j => j._id);

    await MediaArchive.updateMany(
      { _id: { $in: jobIds } },
      {
        $set: {
          status: 'COPYING',
          workerId,
          claimedAt: now
        },
        $inc: { attempts: 1 }
      }
    );

    const formattedJobs = jobs.map(job => ({
      jobId: job._id.toString(),
      eventId: job.eventId,
      registrationId: job.registrationId,
      mediaType: job.mediaType,
      sourceUrl: job.sourceUrl,
      filename: job.filename,
      mimeType: job.mimeType || 'image/jpeg',
      folderPath: job.driveFolderPath || `Ek Duje Ke Liye/Events/${job.eventId}/Couple Photos`
    }));

    res.json({
      success: true,
      count: formattedJobs.length,
      jobs: formattedJobs
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to claim archive batch: ${err.message}` });
  }
};

/**
 * Worker reports successful upload and verification to Google Drive
 */
export const verifyArchivedItem = async (req, res) => {
  try {
    const { jobId, driveFileId, driveFolderId, fileSize, mimeType } = req.body;

    if (!jobId || !driveFileId) {
      return res.status(400).json({ error: 'jobId and driveFileId are required for verification.' });
    }

    // Guard against mock / test verification payloads
    if (!env.ALLOW_MOCK_ARCHIVE_VERIFICATION) {
      const lower = String(driveFileId).toLowerCase();
      if (
        lower.startsWith('mock') ||
        lower.startsWith('test') ||
        lower.startsWith('fake') ||
        lower.startsWith('drive_mock') ||
        lower.includes('placeholder') ||
        lower.startsWith('1abcdefgh')
      ) {
        return res.status(400).json({
          error: 'Mock Drive verification IDs are rejected in production. Real Google Apps Script Drive File ID required.'
        });
      }
    }

    const job = await MediaArchive.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Archive job not found.' });
    }

    if (job.status === 'VERIFIED' || job.status === 'ARCHIVED') {
      return res.json({ success: true, message: 'Item already verified.', job });
    }

    job.status = 'VERIFIED';
    job.driveFileId = driveFileId;
    if (driveFolderId) job.driveFolderId = driveFolderId;
    if (fileSize) job.originalSize = fileSize;
    if (mimeType) job.mimeType = mimeType;
    job.verifiedAt = new Date();
    job.driveVerifiedAt = new Date();
    job.driveVerificationSource = 'google_apps_script';
    job.deleteAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
    job.lastError = null;

    await job.save();

    // Recalculate and update Event progress
    await updateEventArchiveProgress(job.eventId);

    res.json({ success: true, message: 'Item verified and recorded in archive ledger.', jobId });
  } catch (err) {
    res.status(500).json({ error: `Verification recording failed: ${err.message}` });
  }
};

/**
 * Worker reports a failed copy attempt
 */
export const failArchivedItem = async (req, res) => {
  try {
    const { jobId, error } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required.' });
    }

    const job = await MediaArchive.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: 'FAILED',
          lastError: error || 'Unknown Google Drive upload error'
        }
      },
      { returnDocument: 'after' }
    );


    if (job) {
      await updateEventArchiveProgress(job.eventId);
    }

    res.json({ success: true, message: 'Failure recorded.', jobId });
  } catch (err) {
    res.status(500).json({ error: `Failure reporting failed: ${err.message}` });
  }
};

/**
 * ==========================================================
 * 2. SUPER ADMIN APIS (requireSuperAuth)
 * ==========================================================
 */

/**
 * Discovers completed events and calculates archive candidate readiness
 */
export const getArchiveCandidates = async (req, res) => {
  try {
    const [events, regStatsList, archiveStatsList, cleanupCountsList] = await Promise.all([
      Event.find({}, { id: 1, name: 1, sequenceNumber: 1, date: 1, city: 1, status: 1, archiveStatus: 1 }).sort({ sequenceNumber: 1, date: -1 }).lean(),
      Registration.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$programId',
            total: { $sum: 1 },
            couplePhotos: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$couplePhoto', null] },
                      { $ne: ['$couplePhoto', ''] },
                      { $ne: ['$couplePhoto', '/sample_couple.png'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            invitationCards: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$invitationCardUrl', null] }, { $ne: ['$invitationCardUrl', ''] }] },
                  1,
                  0
                ]
              }
            },
            paymentScreenshots: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$paymentScreenshot', null] }, { $ne: ['$paymentScreenshot', ''] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      MediaArchive.aggregate([
        {
          $group: {
            _id: { eventId: '$eventId', status: '$status' },
            count: { $sum: 1 },
            totalBytes: { $sum: '$originalSize' }
          }
        }
      ]),
      MediaArchive.aggregate([
        {
          $match: {
            status: 'VERIFIED',
            cloudinaryOriginalStatus: { $ne: 'DELETED' }
          }
        },
        {
          $group: {
            _id: '$eventId',
            cleanupEligible: { $sum: 1 }
          }
        }
      ])
    ]);

    const regStatsMap = new Map();
    regStatsList.forEach(r => { if (r && r._id) regStatsMap.set(r._id, r); });

    const archiveMap = new Map();
    const bytesMap = new Map();
    archiveStatsList.forEach(a => {
      if (a && a._id && a._id.eventId) {
        const evId = a._id.eventId;
        if (!archiveMap.has(evId)) {
          archiveMap.set(evId, { verified: 0, queued: 0, copying: 0, failed: 0 });
        }
        const s = archiveMap.get(evId);
        const st = a._id.status;
        if (st === 'VERIFIED' || st === 'ARCHIVED' || st === 'DELETE_PENDING') s.verified += a.count;
        else if (st === 'QUEUED') s.queued += a.count;
        else if (st === 'COPYING') s.copying += a.count;
        else if (st === 'FAILED') s.failed += a.count;

        bytesMap.set(evId, (bytesMap.get(evId) || 0) + (a.totalBytes || 0));
      }
    });

    const cleanupMap = new Map();
    cleanupCountsList.forEach(c => {
      if (c && c._id) cleanupMap.set(c._id, c.cleanupEligible);
    });

    const PROTECTED_EVENTS = new Set(['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19']);

    const candidates = events.map(ev => {
      const r = regStatsMap.get(ev.id) || { total: 0, couplePhotos: 0, invitationCards: 0, paymentScreenshots: 0 };
      const a = archiveMap.get(ev.id) || { verified: 0, queued: 0, copying: 0, failed: 0 };

      const totalRegistrations = r.total;
      const couplePhotosCount = r.couplePhotos;
      const invitationCardsCount = r.invitationCards || 0;
      const paymentScreenshotsCount = r.paymentScreenshots || 0;
      const archivedCount = a.verified;
      const queuedCount = a.queued;
      const copyingCount = a.copying;
      const failedCount = a.failed;
      const totalCloudinaryAssets = couplePhotosCount + invitationCardsCount + paymentScreenshotsCount;

      const isCompleted = ev.status === 'completed' || ev.status === 'archived';
      const progressPercent = couplePhotosCount > 0 ? Math.min(100, Math.round((archivedCount / couplePhotosCount) * 100)) : 0;

      // Safe Classification Guard
      const isProtected = PROTECTED_EVENTS.has(ev.id) || ev.status === 'upcoming' || ev.status === 'few_seats' || (ev.sequenceNumber >= 6 && ev.sequenceNumber <= 8);

      let cleanupStatus = 'NOT_APPLICABLE';
      let historicalViewer = 'CLOUDINARY';

      if (isProtected) {
        cleanupStatus = 'PROTECTED';
        historicalViewer = 'CLOUDINARY';
      } else if (isCompleted) {
        if (archivedCount >= couplePhotosCount && couplePhotosCount > 0) {
          cleanupStatus = 'READY';
          historicalViewer = 'DRIVE';
        } else {
          cleanupStatus = 'PENDING_ARCHIVE';
          historicalViewer = archivedCount > 0 ? 'DRIVE' : 'CLOUDINARY';
        }
      } else if (ev.status === 'date_tba' || !ev.date || ev.date === 'TBD' || ev.date === 'Date TBA' || ev.status === 'housefull') {
        cleanupStatus = 'REVIEW_REQUIRED';
        historicalViewer = archivedCount > 0 ? 'DRIVE' : 'CLOUDINARY';
      }

      const cleanupEligible = isProtected ? 0 : (cleanupMap.get(ev.id) || 0);
      const approxBytes = bytesMap.get(ev.id) || Math.round(couplePhotosCount * 1.2 * 1024 * 1024);

      let derivedStatus = ev.archiveStatus || 'NOT_REQUIRED';
      if (!ev.archiveStatus || ev.archiveStatus === 'NOT_REQUIRED') {
        if (archivedCount >= couplePhotosCount && couplePhotosCount > 0) derivedStatus = 'COMPLETED';
        else if (queuedCount > 0) derivedStatus = 'QUEUED';
      }

      return {
        id: ev.id,
        sequence: ev.sequenceNumber,
        name: ev.name,
        date: ev.date,
        city: ev.city || 'Surat',
        status: ev.status,
        isCompleted,
        isProtected,
        cleanupStatus,
        historicalViewer,
        archiveStatus: derivedStatus,
        isCurrentlyActive: derivedStatus === 'ARCHIVING',
        totalRegistrations,
        eligibleCouplePhotos: couplePhotosCount,
        invitationCardsCount,
        paymentScreenshotsCount,
        cloudinaryAssetsCount: totalCloudinaryAssets,
        cleanupEligible,
        archivedAssets: archivedCount,
        queuedAssets: queuedCount,
        copyingAssets: copyingCount,
        failedAssets: failedCount,
        progressPercent,
        estimatedSizeMB: parseFloat((approxBytes / (1024 * 1024)).toFixed(1))
      };
    });

    // Compute Super Admin Storage Summary
    let cloudinaryActiveEvents = 0;
    let cloudinaryAssetCount = 0;
    let driveArchivedEvents = 0;
    let verifiedArchiveCount = 0;
    let pendingArchiveCount = 0;
    let failedArchiveCount = 0;
    let cleanupEligibleCount = 0;
    let protectedActiveAssets = 0;

    candidates.forEach(c => {
      if (c.isProtected) {
        cloudinaryActiveEvents++;
        protectedActiveAssets += c.cloudinaryAssetsCount;
      } else {
        if (c.archivedAssets > 0) driveArchivedEvents++;
        cleanupEligibleCount += c.cleanupEligible;
      }
      cloudinaryAssetCount += c.cloudinaryAssetsCount;
      verifiedArchiveCount += c.archivedAssets;
      pendingArchiveCount += (c.queuedAssets + (c.copyingAssets || 0));
      failedArchiveCount += (c.failedAssets || 0);
    });

    const summary = {
      cloudinaryActiveEvents,
      cloudinaryAssetCount,
      driveArchivedEvents,
      verifiedArchiveCount,
      pendingArchiveCount,
      failedArchiveCount,
      cleanupEligibleCount,
      protectedActiveAssets,
      lastArchiveRun: new Date().toISOString(),
      lastCleanupRun: null
    };

    res.json({ success: true, candidates, summary });
  } catch (err) {
    res.status(500).json({ error: `Failed to load archive candidates: ${err.message}` });
  }
};

/**
 * Super Admin starts archiving a completed event.
 * Strictly enforces ONE active event archive at a time.
 */
export const startEventArchive = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.body?.eventId || req.query?.eventId;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required.' });
    }

    const allEvents = await Event.find(
      {},
      { id: 1, name: 1, slug: 1, status: 1, archiveStatus: 1 }
    ).lean();
    const event = allEvents.find(e => e.id === eventId || e.slug === eventId || String(e._id) === eventId);
    if (!event) {
      return res.status(404).json({ error: `Event "${eventId}" not found.` });
    }

    const targetEventId = event.id || String(event._id);

    // Guard: Prevent archiving active / upcoming events
    const isCompleted = event.status === 'completed' || event.status === 'archived';
    if (!isCompleted) {
      return res.status(400).json({
        error: `Cannot archive event "${event.name}". Only completed or historical events can be archived to Google Drive.`
      });
    }

    // Guard: Enforce ONLY ONE active event in ARCHIVING state
    const currentlyRunning = allEvents.find(e => e.archiveStatus === 'ARCHIVING' && e.id !== targetEventId);
    if (currentlyRunning) {
      console.log('[startEventArchive] Another archive already running:', currentlyRunning.name);
      return res.status(409).json({
        error: `Another event archive is currently running: "${currentlyRunning.name}" (${currentlyRunning.id}). Please wait for it to finish or pause it first.`,
        runningEvent: { id: currentlyRunning.id, name: currentlyRunning.name }
      });
    }

    console.log('[startEventArchive] Step 3: Querying registrations for event...');
    const allSubmissions = await Registration.find(
      { programId: targetEventId, isDeleted: { $ne: true } },
      { inquiryId: 1, couplePhoto: 1, husbandName: 1, wifeName: 1, surname: 1 }
    ).lean();

    const submissions = allSubmissions.filter(sub => {
      const p = sub.couplePhoto;
      return Boolean(p && p !== '/sample_couple.png' && p !== 'null' && p !== '');
    });

    const eventSlug = event.slug || event.id;
    const itemsToInsert = [];

    // Query existing records by indexed eventId (< 10ms)
    const existingRecords = await MediaArchive.find({ eventId: targetEventId }).select('sourcePublicId').lean();
    const existingSet = new Set(existingRecords.map(r => r.sourcePublicId));

    submissions.forEach(sub => {
      let photoUrl = sub.couplePhoto;
      if (!photoUrl) return;
      if (photoUrl.includes('.heic')) {
        photoUrl = photoUrl.replace(/\.heic$/i, '.jpg');
      }
      const publicIdMatch = photoUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/i);
      const publicId = publicIdMatch ? publicIdMatch[1] : `sub_${sub.inquiryId}_photo`;

      if (!existingSet.has(publicId)) {
        const filename = `${sub.inquiryId || 'reg'}_${sub.husbandName || 'couple'}_${sub.wifeName || ''}_${sub.surname || ''}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_');
        itemsToInsert.push({
          eventId: targetEventId,
          registrationId: sub.inquiryId,
          mediaType: 'couple_photo',
          sourceProvider: photoUrl.includes('cloudinary') ? 'cloudinary' : 'local',
          sourcePublicId: publicId,
          sourceUrl: photoUrl.startsWith('http') ? photoUrl : `https://ekdujekeliye.onrender.com${photoUrl}`,
          destinationProvider: 'google_drive',
          driveFolderPath: `Ek Duje Ke Liye/Events/${eventSlug}/Couple Photos`,
          filename,
          mimeType: 'image/jpeg',
          status: 'QUEUED',
          retainOperationalCopy: true
        });
      }
    });

    if (itemsToInsert.length > 0) {
      try {
        await MediaArchive.collection.insertMany(itemsToInsert, { ordered: false });
      } catch (insertErr) {
        // Expected duplicate key handling for idempotent queueing
      }
    }

    const queuedCount = itemsToInsert.length + existingSet.size;

    await Event.updateOne(
      { id: targetEventId },
      {
        $set: {
          archiveStatus: 'ARCHIVING',
          archiveRequestedAt: new Date(),
          archiveStartedAt: event.archiveStartedAt || new Date(),
          archiveRequestedBy: 'SUPER_ADMIN',
          archiveStats: {
            totalAssets: submissions.length,
            queuedAssets: queuedCount,
            copyingAssets: 0,
            archivedAssets: 0,
            failedAssets: 0,
            totalBytes: 0,
            lastWorkerAt: null
          }
        }
      }
    );

    return res.json({
      success: true,
      message: `Google Drive archive started for ${event.name}. Automatic worker will process remaining batches.`,
      eventId: targetEventId,
      archiveStatus: 'ARCHIVING',
      stats: {
        totalAssets: submissions.length,
        queuedAssets: queuedCount,
        copyingAssets: 0,
        archivedAssets: 0,
        failedAssets: 0,
        totalBytes: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to start event archive: ${err.message}` });
  }
};

/**
 * Super Admin pauses an ongoing event archive
 */
export const pauseEventArchive = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    event.archiveStatus = 'PAUSED';
    await event.save();
    const updated = await updateEventArchiveProgress(eventId);

    res.json({
      success: true,
      message: `Archive paused for ${event.name}.`,
      eventId,
      archiveStatus: 'PAUSED',
      stats: updated.archiveStats
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to pause archive: ${err.message}` });
  }
};

/**
 * Super Admin resumes a paused event archive
 */
export const resumeEventArchive = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Check if another event is running
    const currentlyRunning = await Event.findOne({
      archiveStatus: 'ARCHIVING',
      id: { $ne: eventId }
    }).lean();

    if (currentlyRunning) {
      return res.status(409).json({
        error: `Another event archive is currently running: "${currentlyRunning.name}". Please pause it first.`
      });
    }

    event.archiveStatus = 'ARCHIVING';
    await event.save();
    const updated = await updateEventArchiveProgress(eventId);

    res.json({
      success: true,
      message: `Archive resumed for ${event.name}.`,
      eventId,
      archiveStatus: 'ARCHIVING',
      stats: updated.archiveStats
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to resume archive: ${err.message}` });
  }
};

/**
 * Super Admin retries failed items for a specific event
 */
export const retryEventFailedJobs = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const result = await MediaArchive.updateMany(
      { eventId, status: 'FAILED' },
      {
        $set: {
          status: 'QUEUED',
          lastError: null,
          workerId: null,
          claimedAt: null
        }
      }
    );

    if (event.archiveStatus === 'PARTIAL' || event.archiveStatus === 'PAUSED') {
      event.archiveStatus = 'ARCHIVING';
      await event.save();
    }

    const updated = await updateEventArchiveProgress(eventId);

    res.json({
      success: true,
      message: `Re-queued ${result.modifiedCount} failed job(s) for ${event.name}.`,
      eventId,
      requeuedCount: result.modifiedCount,
      archiveStatus: updated.archiveStatus,
      stats: updated.archiveStats
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to retry failed jobs: ${err.message}` });
  }
};

/**
 * Super Admin queues exactly ONE single couple photo registration
 */
export const queueSingleAsset = async (req, res) => {
  try {
    const { registrationId, eventId } = req.body;
    if (!registrationId || !eventId) {
      return res.status(400).json({ error: 'registrationId and eventId are required.' });
    }

    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const sub = await Registration.findOne({
      inquiryId: registrationId,
      programId: eventId,
      isDeleted: { $ne: true }
    });

    if (!sub) {
      return res.status(404).json({ error: `Registration ${registrationId} not found in event ${eventId}.` });
    }

    const photoUrl = sub.couplePhoto;
    if (!photoUrl || photoUrl === '/sample_couple.png' || !photoUrl.includes('cloudinary')) {
      return res.status(400).json({ error: 'Registration does not contain an eligible Cloudinary couple photo.' });
    }

    const publicIdMatch = photoUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/i);
    const publicId = publicIdMatch ? publicIdMatch[1] : `sub_${sub.inquiryId}_photo`;
    const filename = `${sub.inquiryId}_${sub.husbandName}_${sub.wifeName}_${sub.surname}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const eventSlug = event.slug || event.id;

    let archive = await MediaArchive.findOne({ sourcePublicId: publicId });
    if (archive) {
      return res.json({
        success: true,
        message: 'Media archive record already exists for this registration.',
        jobId: archive._id.toString(),
        registrationId: sub.inquiryId,
        eventId,
        status: archive.status,
        filename: archive.filename,
        sourceUrl: archive.sourceUrl,
        folderPath: archive.driveFolderPath
      });
    }

    archive = await MediaArchive.create({
      eventId,
      registrationId: sub.inquiryId,
      mediaType: 'couple_photo',
      sourceProvider: 'cloudinary',
      sourcePublicId: publicId,
      sourceUrl: photoUrl,
      destinationProvider: 'google_drive',
      driveFolderPath: `Ek Duje Ke Liye/Events/${eventSlug}/Couple Photos`,
      filename,
      mimeType: 'image/jpeg',
      status: 'QUEUED',
      retainOperationalCopy: true
    });

    res.json({
      success: true,
      message: `Successfully queued single asset for registration ${registrationId}.`,
      jobId: archive._id.toString(),
      registrationId: sub.inquiryId,
      eventId,
      status: archive.status,
      filename: archive.filename,
      sourceUrl: archive.sourceUrl,
      folderPath: archive.driveFolderPath
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to queue single asset: ${err.message}` });
  }
};

/**
 * Super Admin queues a completed event for Google Drive archiving
 */
export const queueEventArchive = async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required.' });
    }

    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const submissions = await Registration.find({
      programId: eventId,
      isDeleted: { $ne: true },
      couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
    }).lean();

    const eventSlug = event.slug || event.id;
    const itemsToInsert = [];

    const publicIds = submissions.map(sub => {
      const photoUrl = sub.couplePhoto;
      const publicIdMatch = photoUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/i);
      return publicIdMatch ? publicIdMatch[1] : `sub_${sub.inquiryId}_photo`;
    });

    const existingRecords = await MediaArchive.find({ sourcePublicId: { $in: publicIds } }).select('sourcePublicId').lean();
    const existingSet = new Set(existingRecords.map(r => r.sourcePublicId));

    submissions.forEach(sub => {
      const photoUrl = sub.couplePhoto;
      const publicIdMatch = photoUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/i);
      const publicId = publicIdMatch ? publicIdMatch[1] : `sub_${sub.inquiryId}_photo`;

      if (!existingSet.has(publicId)) {
        const filename = `${sub.inquiryId}_${sub.husbandName}_${sub.wifeName}_${sub.surname}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_');
        itemsToInsert.push({
          eventId,
          registrationId: sub.inquiryId,
          mediaType: 'couple_photo',
          sourceProvider: photoUrl.includes('cloudinary') ? 'cloudinary' : 'local',
          sourcePublicId: publicId,
          sourceUrl: photoUrl.startsWith('http') ? photoUrl : `${env.NODE_ENV === 'production' ? 'https://ekdujekeliye.onrender.com' : 'http://localhost:5001'}${photoUrl}`,
          destinationProvider: 'google_drive',
          driveFolderPath: `Ek Duje Ke Liye/Events/${eventSlug}/Couple Photos`,
          filename,
          mimeType: 'image/jpeg',
          status: 'QUEUED',
          retainOperationalCopy: true
        });
      }
    });

    if (itemsToInsert.length > 0) {
      await MediaArchive.insertMany(itemsToInsert, { ordered: false });
    }

    const updated = await updateEventArchiveProgress(eventId);

    res.json({
      success: true,
      message: `Successfully discovered and queued ${itemsToInsert.length} couple photo(s) for archiving.`,
      eventId,
      queuedCount: itemsToInsert.length,
      totalEligible: submissions.length,
      stats: updated.archiveStats
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to queue event archive: ${err.message}` });
  }
};

/**
 * Returns paginated list of archive jobs with status filters
 */
export const getArchiveJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
    const status = req.query.status;
    const eventId = req.query.eventId;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (eventId && eventId !== 'all') filter.eventId = eventId;

    const [jobs, total, statusCounts, cleanedCount] = await Promise.all([
      MediaArchive.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MediaArchive.countDocuments(filter),
      MediaArchive.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      MediaArchive.countDocuments({ cloudinaryOriginalStatus: 'DELETED' })
    ]);

    const summary = {
      QUEUED: 0,
      COPYING: 0,
      VERIFIED: 0,
      ARCHIVED: 0,
      FAILED: 0,
      CLEANED_CLOUDINARY: cleanedCount
    };
    statusCounts.forEach(s => {
      if (summary[s._id] !== undefined) summary[s._id] = s.count;
    });

    res.json({
      success: true,
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve archive jobs: ${err.message}` });
  }
};

/**
 * Retries failed archive jobs
 */
export const retryFailedJobs = async (req, res) => {
  try {
    const { eventId } = req.body;
    const filter = { status: 'FAILED' };
    if (eventId && eventId !== 'all') filter.eventId = eventId;

    const result = await MediaArchive.updateMany(
      filter,
      {
        $set: {
          status: 'QUEUED',
          lastError: null,
          workerId: null,
          claimedAt: null
        }
      }
    );

    if (eventId && eventId !== 'all') {
      await updateEventArchiveProgress(eventId);
    }

    res.json({ success: true, message: `Reset ${result.modifiedCount} failed job(s) to QUEUED state.` });
  } catch (err) {
    res.status(500).json({ error: `Retry failed: ${err.message}` });
  }
};

/**
 * ==========================================================
 * 3. CLOUDINARY CLEANUP & THUMBNAIL APIS (requireSuperAuth)
 * ==========================================================
 */

/**
 * Super Admin dry-run cleanup preflight check for a single registration
 * Does NOT delete anything. Returns READY_FOR_DELETE or BLOCKED with reasons.
 */
export const cleanupPreflightSingleAsset = async (req, res) => {
  try {
    const { registrationId } = req.params;
    if (!registrationId) {
      return res.status(400).json({ error: 'registrationId is required.' });
    }

    const archive = await MediaArchive.findOne({ registrationId });
    if (!archive) {
      return res.status(404).json({ error: `Archive record not found for registration ${registrationId}.` });
    }

    const [event, registration] = await Promise.all([
      Event.findOne({ id: archive.eventId }).lean(),
      Registration.findOne({ inquiryId: registrationId, isDeleted: { $ne: true } }).lean()
    ]);

    // Check whole event archive progress
    const [submissionsCount, archives] = await Promise.all([
      Registration.countDocuments({
        programId: archive.eventId,
        isDeleted: { $ne: true },
        couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
      }),
      MediaArchive.find({ eventId: archive.eventId }).select('status').lean()
    ]);

    let verified = 0;
    let queued = 0;
    let copying = 0;
    let failed = 0;

    archives.forEach(a => {
      if (a.status === 'VERIFIED' || a.status === 'ARCHIVED') verified++;
      else if (a.status === 'QUEUED') queued++;
      else if (a.status === 'COPYING') copying++;
      else if (a.status === 'FAILED') failed++;
    });

    const isEventFullyArchived = submissionsCount > 0 && queued === 0 && copying === 0 && failed === 0 && verified >= submissionsCount;
    const isItemVerified = archive.status === 'VERIFIED' || archive.status === 'ARCHIVED';
    const hasRealDriveFileId = Boolean(
      archive.driveFileId &&
      !archive.driveFileId.startsWith('1AbCdEfGh') &&
      !archive.driveFileId.toLowerCase().includes('mock') &&
      !archive.driveFileId.toLowerCase().includes('placeholder')
    );
    const hasOperationalThumbnail = Boolean(archive.operationalThumbnailUrl);

    // Test Cloudinary original existence via HEAD
    let cloudinaryOriginalExists = false;
    try {
      if (archive.sourceUrl) {
        const headRes = await fetch(archive.sourceUrl, { method: 'HEAD' });
        cloudinaryOriginalExists = (headRes.status === 200);
      }
    } catch (e) {
      cloudinaryOriginalExists = false;
    }

    const blockingReasons = [];
    if (!isEventFullyArchived) {
      blockingReasons.push(
        `Event "${event?.name || archive.eventId}" is not 100% archived (Eligible: ${submissionsCount}, Verified: ${verified}, Queued: ${queued}, Copying: ${copying}, Failed: ${failed}).`
      );
    }
    if (!isItemVerified) {
      blockingReasons.push(`Registration archive status is ${archive.status} (must be VERIFIED).`);
    }
    if (!hasRealDriveFileId) {
      blockingReasons.push('Verified Google Drive file ID is missing or invalid.');
    }
    if (!env.CLOUDINARY_CLEANUP_ENABLED) {
      blockingReasons.push('Feature flag CLOUDINARY_CLEANUP_ENABLED is set to FALSE on server.');
    }
    if (!hasOperationalThumbnail) {
      blockingReasons.push('Independent operational thumbnail has not been created yet.');
    }

    const status = blockingReasons.length === 0 ? 'READY_FOR_DELETE' : 'BLOCKED';

    res.json({
      success: true,
      registrationId,
      eventId: archive.eventId,
      eventName: event?.name || archive.eventId,
      status,
      isReady: status === 'READY_FOR_DELETE',
      blockingReasons,
      checks: {
        isItemVerified,
        hasRealDriveFileId,
        driveFileId: archive.driveFileId,
        hasOperationalThumbnail,
        operationalThumbnailUrl: archive.operationalThumbnailUrl,
        operationalThumbnailPublicId: archive.operationalThumbnailPublicId,
        cloudinaryOriginalExists,
        cloudinaryOriginalStatus: archive.cloudinaryOriginalStatus || 'ACTIVE',
        featureFlagCleanupEnabled: env.CLOUDINARY_CLEANUP_ENABLED === true,
        eventArchiveCompletion: {
          totalEligible: submissionsCount,
          verified,
          queued,
          copying,
          failed,
          isFullyArchived: isEventFullyArchived
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Preflight check failed: ${err.message}` });
  }
};

/**
 * Super Admin creates an independent operational thumbnail on Cloudinary without deleting the original
 */
export const createOperationalThumbnailAsset = async (req, res) => {
  try {
    const { registrationId } = req.params;
    if (!registrationId) {
      return res.status(400).json({ error: 'registrationId is required.' });
    }

    const archive = await MediaArchive.findOne({ registrationId });
    if (!archive) {
      return res.status(404).json({ error: `Archive record not found for registration ${registrationId}.` });
    }

    const event = await Event.findOne({ id: archive.eventId }).lean();
    const eventSlug = event?.slug || archive.eventId;

    // Use mediaService to create independent thumbnail
    const thumbResult = await mediaService.createOperationalThumbnail({
      sourceUrl: archive.sourceUrl,
      eventSlug,
      inquiryId: registrationId,
      publicId: archive.sourcePublicId
    });

    archive.operationalThumbnailUrl = thumbResult.operationalThumbnailUrl;
    archive.operationalThumbnailPublicId = thumbResult.operationalThumbnailPublicId;
    archive.thumbnailSizeBytes = thumbResult.thumbnailSizeBytes;
    archive.thumbnailCreatedAt = thumbResult.thumbnailCreatedAt;

    await archive.save();

    res.json({
      success: true,
      message: `Operational thumbnail created successfully for ${registrationId}.`,
      registrationId,
      eventId: archive.eventId,
      thumbnail: {
        url: thumbResult.operationalThumbnailUrl,
        publicId: thumbResult.operationalThumbnailPublicId,
        sizeBytes: thumbResult.thumbnailSizeBytes,
        format: thumbResult.format,
        width: thumbResult.width,
        height: thumbResult.height
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to create operational thumbnail: ${err.message}` });
  }
};

/**
 * Super Admin controlled deletion with HARD SERVER-SIDE SAFETY GATE
 * Destructive deletion will NEVER execute unless all safety gates pass.
 */
export const cleanupOriginalAsset = async (req, res) => {
  try {
    const { registrationId } = req.params;
    if (!registrationId) {
      return res.status(400).json({ error: 'registrationId is required.' });
    }

    // 1. HARD FEATURE FLAG CHECK
    if (!env.CLOUDINARY_CLEANUP_ENABLED) {
      return res.status(403).json({
        success: false,
        code: 'CLEANUP_FEATURE_FLAG_DISABLED',
        error: 'Destructive Cloudinary cleanup is disabled by server configuration (CLOUDINARY_CLEANUP_ENABLED=false).'
      });
    }

    const archive = await MediaArchive.findOne({ registrationId });
    if (!archive) {
      return res.status(404).json({ error: `Archive record not found for registration ${registrationId}.` });
    }

    // IMMUTABLE SAFETY GATE: Upcoming events are strictly protected
    const PROTECTED_EVENTS = new Set(['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19']);
    const PROTECTED_PREFIXES = ['EK06-', 'EK07-', 'EK08-'];
    if (PROTECTED_EVENTS.has(archive.eventId) || PROTECTED_PREFIXES.some(p => registrationId.startsWith(p))) {
      return res.status(403).json({
        success: false,
        code: 'PROTECTED_UPCOMING_EVENT',
        error: `Cannot delete asset for upcoming event ${archive.eventId}. Upcoming events are strictly protected.`
      });
    }

    // 2. HARD SERVER-SIDE SAFETY GATE: Event Archive 100% Verified Check
    const [submissionsCount, archives] = await Promise.all([
      Registration.countDocuments({
        programId: archive.eventId,
        isDeleted: { $ne: true },
        couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
      }),
      MediaArchive.find({ eventId: archive.eventId }).select('status').lean()
    ]);

    let verified = 0;
    let queued = 0;
    let copying = 0;
    let failed = 0;

    archives.forEach(a => {
      if (a.status === 'VERIFIED' || a.status === 'ARCHIVED') verified++;
      else if (a.status === 'QUEUED') queued++;
      else if (a.status === 'COPYING') copying++;
      else if (a.status === 'FAILED') failed++;
    });

    if (submissionsCount === 0 || queued > 0 || copying > 0 || failed > 0 || verified < submissionsCount) {
      return res.status(409).json({
        success: false,
        code: 'EVENT_ARCHIVE_INCOMPLETE',
        message: 'Cloudinary cleanup is blocked until the entire event archive is verified.',
        progress: {
          eligible: submissionsCount,
          verified,
          queued,
          copying,
          failed
        }
      });
    }

    // 3. Item-level verification check
    if (archive.status !== 'VERIFIED' && archive.status !== 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        error: `Cannot delete original: Item status is "${archive.status}" (must be VERIFIED).`
      });
    }

    if (!archive.driveFileId || archive.driveFileId.startsWith('1AbCdEfGh') || archive.driveFileId.toLowerCase().includes('mock')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete original: Valid Google Drive File ID is missing.'
      });
    }

    // 4. Ensure operational thumbnail exists before deleting original
    if (!archive.operationalThumbnailUrl) {
      const event = await Event.findOne({ id: archive.eventId }).lean();
      const thumbResult = await mediaService.createOperationalThumbnail({
        sourceUrl: archive.sourceUrl,
        eventSlug: event?.slug || archive.eventId,
        inquiryId: registrationId,
        publicId: archive.sourcePublicId
      });
      archive.operationalThumbnailUrl = thumbResult.operationalThumbnailUrl;
      archive.operationalThumbnailPublicId = thumbResult.operationalThumbnailPublicId;
      archive.thumbnailSizeBytes = thumbResult.thumbnailSizeBytes;
      archive.thumbnailCreatedAt = thumbResult.thumbnailCreatedAt;
      await archive.save();
    }

    // 5. Delete only the original Cloudinary resource using stored sourcePublicId
    let fullPublicId = archive.sourcePublicId;
    if (archive.sourceUrl && archive.sourceUrl.includes('/couplePhotos/') && !fullPublicId.startsWith('couplePhotos/')) {
      fullPublicId = `couplePhotos/${fullPublicId}`;
    }
    if (fullPublicId && archive.sourceProvider === 'cloudinary') {
      await cloudinary.uploader.destroy(fullPublicId);
    }

    archive.cloudinaryOriginalStatus = 'DELETED';
    archive.cloudinaryOriginalDeletedAt = new Date();
    await archive.save();

    res.json({
      success: true,
      message: `Successfully cleaned up Cloudinary original asset for ${registrationId}.`,
      registrationId,
      operationalThumbnailUrl: archive.operationalThumbnailUrl,
      driveFileId: archive.driveFileId,
      cloudinaryOriginalStatus: 'DELETED',
      cloudinaryOriginalDeletedAt: archive.cloudinaryOriginalDeletedAt
    });
  } catch (err) {
    res.status(500).json({ error: `Cleanup failed: ${err.message}` });
  }
};

