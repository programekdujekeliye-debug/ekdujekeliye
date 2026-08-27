import { MediaArchive } from '../../models/MediaArchive.js';
import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

/**
 * ==========================================================
 * HELPER: Recalculate and update Event archive progress stats
 * ==========================================================
 */
export const updateEventArchiveProgress = async (eventId) => {
  try {
    const event = await Event.findOne({ id: eventId });
    if (!event) return null;

    const [submissionsCount, archives] = await Promise.all([
      Registration.countDocuments({
        programId: eventId,
        isDeleted: { $ne: true },
        couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
      }),
      MediaArchive.find({ eventId }).select('status originalSize').lean()
    ]);

    let verified = 0;
    let queued = 0;
    let copying = 0;
    let failed = 0;
    let totalBytes = 0;

    archives.forEach(a => {
      if (a.status === 'VERIFIED' || a.status === 'ARCHIVED' || a.status === 'DELETE_PENDING') {
        verified++;
        totalBytes += (a.originalSize || 0);
      } else if (a.status === 'QUEUED') {
        queued++;
      } else if (a.status === 'COPYING') {
        copying++;
      } else if (a.status === 'FAILED') {
        failed++;
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
      { new: true }
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
    const events = await Event.find().sort({ date: -1 }).lean();

    const candidates = await Promise.all(
      events.map(async (ev) => {
        const totalRegistrations = await Registration.countDocuments({
          programId: ev.id,
          isDeleted: false
        });

        const couplePhotosCount = await Registration.countDocuments({
          programId: ev.id,
          isDeleted: false,
          couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
        });

        const archives = await MediaArchive.find({ eventId: ev.id }).select('status').lean();

        let archivedCount = 0;
        let queuedCount = 0;
        let copyingCount = 0;
        let failedCount = 0;

        archives.forEach(a => {
          if (a.status === 'VERIFIED' || a.status === 'ARCHIVED' || a.status === 'DELETE_PENDING') archivedCount++;
          else if (a.status === 'QUEUED') queuedCount++;
          else if (a.status === 'COPYING') copyingCount++;
          else if (a.status === 'FAILED') failedCount++;
        });

        const isCompleted = ev.status === 'completed' || ev.status === 'archived';
        const progressPercent = couplePhotosCount > 0 ? Math.min(100, Math.round((archivedCount / couplePhotosCount) * 100)) : 0;

        let derivedStatus = ev.archiveStatus || 'NOT_REQUIRED';
        if (!ev.archiveStatus || ev.archiveStatus === 'NOT_REQUIRED') {
          if (archivedCount >= couplePhotosCount && couplePhotosCount > 0) derivedStatus = 'COMPLETED';
          else if (queuedCount > 0) derivedStatus = 'QUEUED';
        }

        return {
          id: ev.id,
          name: ev.name,
          date: ev.date,
          city: ev.city || 'Surat',
          status: ev.status,
          isCompleted,
          archiveStatus: derivedStatus,
          isCurrentlyActive: derivedStatus === 'ARCHIVING',
          totalRegistrations,
          eligibleCouplePhotos: couplePhotosCount,
          archivedAssets: archivedCount,
          queuedAssets: queuedCount,
          copyingAssets: copyingCount,
          failedAssets: failedCount,
          progressPercent,
          estimatedSizeMB: parseFloat(((couplePhotosCount * 1.2)).toFixed(1))
        };
      })
    );

    res.json({ success: true, candidates });
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
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required.' });
    }

    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Guard: Prevent archiving active / upcoming events
    const isCompleted = event.status === 'completed' || event.status === 'archived';
    if (!isCompleted) {
      return res.status(400).json({
        error: `Cannot archive event "${event.name}". Only completed or historical events can be archived to Google Drive.`
      });
    }

    // Guard: Enforce ONLY ONE active event in ARCHIVING state
    const currentlyRunning = await Event.findOne({
      archiveStatus: 'ARCHIVING',
      id: { $ne: eventId }
    }).lean();

    if (currentlyRunning) {
      return res.status(409).json({
        error: `Another event archive is currently running: "${currentlyRunning.name}" (${currentlyRunning.id}). Please wait for it to finish or pause it first.`,
        runningEvent: { id: currentlyRunning.id, name: currentlyRunning.name }
      });
    }

    // 1. Discover all eligible couple photos for this event
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
      await MediaArchive.insertMany(itemsToInsert, { ordered: false });
    }

    event.archiveStatus = 'ARCHIVING';
    event.archiveRequestedAt = new Date();
    event.archiveStartedAt = event.archiveStartedAt || new Date();
    event.archiveRequestedBy = 'SUPER_ADMIN';
    await event.save();

    const updatedEvent = await updateEventArchiveProgress(eventId);

    res.json({
      success: true,
      message: `Google Drive archive started for ${event.name}. Automatic worker will process remaining batches.`,
      eventId,
      archiveStatus: updatedEvent.archiveStatus,
      stats: updatedEvent.archiveStats
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

    const [jobs, total, statusCounts] = await Promise.all([
      MediaArchive.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MediaArchive.countDocuments(filter),
      MediaArchive.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const summary = {
      QUEUED: 0,
      COPYING: 0,
      VERIFIED: 0,
      ARCHIVED: 0,
      FAILED: 0
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
