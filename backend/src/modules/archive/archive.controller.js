import { MediaArchive } from '../../models/MediaArchive.js';
import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

/**
 * ==========================================================
 * 1. GOOGLE-SIDE WORKER APIS (Bearer <ARCHIVE_WORKER_SECRET>)
 * ==========================================================
 */

/**
 * Atomically claims a batch of queued archive jobs for Google Apps Script
 */
export const claimArchiveBatch = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || req.body.limit || '15', 10), 50);
    const workerId = req.body.workerId || req.query.workerId || 'gas-worker-1';
    const now = new Date();
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 mins stale lock

    // Find and atomically transition jobs from QUEUED -> COPYING
    const jobs = await MediaArchive.find({
      $or: [
        { status: 'QUEUED' },
        { status: 'COPYING', claimedAt: { $lt: staleThreshold } }
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

    const job = await MediaArchive.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Archive job not found.' });
    }

    // Idempotent: If already verified, return success without duplicate work
    if (job.status === 'VERIFIED' || job.status === 'ARCHIVED') {
      return res.json({ success: true, message: 'Item already verified.', job });
    }

    job.status = 'VERIFIED';
    job.driveFileId = driveFileId;
    if (driveFolderId) job.driveFolderId = driveFolderId;
    if (fileSize) job.originalSize = fileSize;
    if (mimeType) job.mimeType = mimeType;
    job.verifiedAt = new Date();
    // Schedule safe Cloudinary deletion after 24-hour verification window
    job.deleteAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
    job.lastError = null;

    await job.save();

    // Update parent event progress stats
    await Event.findOneAndUpdate(
      { id: job.eventId },
      {
        $inc: { 'archiveStats.archivedAssets': 1, 'archiveStats.totalBytes': fileSize || 0 },
        $set: { archiveStatus: 'ARCHIVING' }
      }
    );

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
      await Event.findOneAndUpdate(
        { id: job.eventId },
        { $inc: { 'archiveStats.failedAssets': 1 } }
      );
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

        const archivedCount = await MediaArchive.countDocuments({
          eventId: ev.id,
          status: { $in: ['VERIFIED', 'ARCHIVED', 'DELETE_PENDING'] }
        });

        const queuedCount = await MediaArchive.countDocuments({
          eventId: ev.id,
          status: { $in: ['QUEUED', 'COPYING'] }
        });

        const isCompleted = ev.status === 'completed' || ev.status === 'archived';

        return {
          id: ev.id,
          name: ev.name,
          date: ev.date,
          city: ev.city || 'Surat',
          status: ev.status,
          isCompleted,
          archiveStatus: ev.archiveStatus || (archivedCount > 0 && archivedCount >= couplePhotosCount ? 'ARCHIVED' : queuedCount > 0 ? 'QUEUED' : 'NOT_REQUIRED'),
          totalRegistrations,
          eligibleCouplePhotos: couplePhotosCount,
          archivedAssets: archivedCount,
          queuedAssets: queuedCount,
          estimatedSizeMB: parseFloat(((couplePhotosCount * 1.2)).toFixed(1)) // ~1.2MB avg per couple photo
        };
      })
    );

    res.json({ success: true, candidates });
  } catch (err) {
    res.status(500).json({ error: `Failed to load archive candidates: ${err.message}` });
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

    // Find all valid couple photos for this event
    const submissions = await Registration.find({
      programId: eventId,
      isDeleted: false,
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

    const queuedCount = itemsToInsert.length;
    event.archiveStatus = queuedCount > 0 ? 'QUEUED' : (event.archiveStatus || 'NOT_REQUIRED');
    event.archiveStats = {
      totalAssets: submissions.length,
      archivedAssets: (event.archiveStats?.archivedAssets || 0),
      failedAssets: 0,
      totalBytes: 0
    };
    await event.save();

    res.json({
      success: true,
      message: `Successfully discovered and queued ${queuedCount} couple photo(s) for archiving.`,
      eventId,
      queuedCount,
      totalEligible: submissions.length
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
          claimedAt: null
        }
      }
    );

    res.json({ success: true, message: `Reset ${result.modifiedCount} failed job(s) to QUEUED state.` });
  } catch (err) {
    res.status(500).json({ error: `Retry failed: ${err.message}` });
  }
};
