import crypto from 'crypto';
import { registrationService } from './registration.service.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { Counter, getNextSequence } from '../../models/Counter.js';
import { storageService } from '../../services/storage.service.js';

export const submitRegistration = async (req, res) => {
  const { husbandName, wifeName, surname, phoneNumber, programId } = req.body;
  if (!husbandName || !wifeName || !surname || !phoneNumber || !programId) {
    return res.status(400).json({ error: 'All fields including couple names, phone number, and program slot are required.' });
  }

  const couplePhotoFile = req.files && req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;

  try {
    const result = await registrationService.createRegistration({
      husbandName,
      wifeName,
      surname,
      phoneNumber,
      programId,
      couplePhotoFile
    });

    res.status(200).json({
      success: true,
      message: 'Registration created successfully. Please proceed with payment.',
      inquiryId: result.inquiryId,
      customerToken: result.customerToken,
      amount: result.amount,
      programName: result.programName
    });
  } catch (err) {
    if (err.alreadyRegistered) {
      return res.status(400).json({
        error: err.message,
        alreadyRegistered: true,
        inquiryId: err.inquiryId,
        status: err.statusType,
        customerToken: err.customerToken
      });
    }
    res.status(err.status || 500).json({ error: err.message || 'Server error processing registration.' });
  }
};

export const getRegistrationStatus = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const result = await registrationService.getStatus(inquiryId);
    if (!result) return res.status(404).json({ error: 'Registration not found.' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error retrieving status.' });
  }
};

export const approveRegistration = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const sub = await Registration.findOne({ inquiryId });
    if (!sub) return res.status(404).json({ error: 'Registration not found.' });

    sub.status = 'approved';
    if (!sub.payment) {
      sub.payment = { provider: 'manual', status: 'captured', amount: 1500, currency: 'INR' };
    }
    sub.payment.status = 'captured';
    sub.payment.paidAt = new Date();
    await sub.save();

    res.json({ success: true, message: 'Registration approved.', submission: sub });
  } catch (err) {
    res.status(500).json({ error: 'Server error approving registration.' });
  }
};

export const rejectRegistration = async (req, res) => {
  const { inquiryId } = req.params;
  const { reason } = req.body;
  try {
    const sub = await Registration.findOne({ inquiryId });
    if (!sub) return res.status(404).json({ error: 'Registration not found.' });

    sub.status = 'rejected';
    sub.rejectionReason = reason || 'Declined by administrator';
    await sub.save();

    res.json({ success: true, message: 'Registration rejected.', submission: sub });
  } catch (err) {
    res.status(500).json({ error: 'Server error rejecting registration.' });
  }
};

export const markAttendance = async (req, res) => {
  const { inquiryId } = req.params;
  const { attendance, attended } = req.body;
  try {
    const sub = await Registration.findOne({ inquiryId });
    if (!sub) return res.status(404).json({ error: 'Registration not found.' });

    if (attendance) {
      sub.attendance = attendance;
    } else {
      sub.attendance = attended !== undefined ? (attended ? 'present' : 'absent') : 'present';
    }
    sub.attendanceMarkedAt = new Date();
    await sub.save();

    res.json({ success: true, attendance: sub.attendance, markedAt: sub.attendanceMarkedAt });
  } catch (err) {
    res.status(500).json({ error: 'Server error marking attendance.' });
  }
};

export const bulkUpdateAttendance = async (req, res) => {
  const { inquiryIds, attendance } = req.body;
  if (!Array.isArray(inquiryIds) || inquiryIds.length === 0) {
    return res.status(400).json({ error: 'No inquiry IDs provided.' });
  }

  try {
    await Registration.updateMany(
      { inquiryId: { $in: inquiryIds } },
      { $set: { attendance: attendance || 'present', attendanceMarkedAt: new Date() } }
    );
    res.json({ success: true, count: inquiryIds.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating bulk attendance.' });
  }
};

export const attendanceByAbsentees = async (req, res) => {
  const { programId, absentInquiryIds = [] } = req.body;
  if (!programId) {
    return res.status(400).json({ error: 'Program ID is required.' });
  }

  try {
    const absenteesSet = new Set(absentInquiryIds.map(s => String(s).trim().toUpperCase()));
    
    // Mark absentees
    if (absentInquiryIds.length > 0) {
      await Registration.updateMany(
        { programId, inquiryId: { $in: Array.from(absenteesSet) } },
        { $set: { attendance: 'absent', attendanceMarkedAt: new Date() } }
      );
    }

    // Mark all other approved couples in this program as present
    await Registration.updateMany(
      { programId, status: 'approved', inquiryId: { $nin: Array.from(absenteesSet) }, isDeleted: { $ne: true } },
      { $set: { attendance: 'present', attendanceMarkedAt: new Date() } }
    );

    res.json({ success: true, message: 'Attendance processed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error processing absentees attendance.' });
  }
};

export const bulkMoveSubmissions = async (req, res) => {
  const { inquiryIds, targetProgramId } = req.body;
  if (!Array.isArray(inquiryIds) || inquiryIds.length === 0 || !targetProgramId) {
    return res.status(400).json({ error: 'Inquiry IDs and target program ID are required.' });
  }

  try {
    const targetProgram = await Event.findOne({ id: targetProgramId });
    if (!targetProgram) {
      return res.status(404).json({ error: 'Target program slot not found.' });
    }

    await Registration.updateMany(
      { inquiryId: { $in: inquiryIds } },
      {
        $set: {
          programId: targetProgram.id,
          programName: targetProgram.name,
          programDate: targetProgram.date,
          programTime: targetProgram.time || '8:30 PM'
        }
      }
    );

    res.json({ success: true, message: `Moved ${inquiryIds.length} submissions successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Server error moving submissions.' });
  }
};

export const manualInviteeRegistration = async (req, res) => {
  const { husbandName, wifeName, surname, phoneNumber, programId } = req.body;
  if (!husbandName || !wifeName || !surname || !phoneNumber || !programId) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const program = await Event.findOne({ id: programId });
    if (!program) return res.status(404).json({ error: 'Program not found.' });

    const counterVal = await getNextSequence('manualInquiryNumber');
    const inquiryId = `IP-${String(counterVal).padStart(2, '0')}`;

    let couplePhotoUrl = '/sample_couple.png';
    const couplePhotoFile = req.files && req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;
    if (couplePhotoFile && couplePhotoFile.buffer) {
      const base64Data = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
      couplePhotoUrl = await storageService.upload({
        data: base64Data,
        folder: 'couplePhotos',
        filename: `${inquiryId}_couple`
      });
    }

    const sub = new Registration({
      inquiryId,
      customerToken: crypto.randomBytes(16).toString('hex'),
      husbandName,
      wifeName,
      surname,
      phoneNumber,
      programId: program.id,
      programName: program.name,
      programDate: program.date,
      programTime: program.time || '8:30 PM',
      couplePhoto: couplePhotoUrl,
      status: 'approved',
      payment: {
        provider: 'manual_invite',
        status: 'captured',
        amount: 0,
        currency: 'INR',
        paidAt: new Date()
      }
    });

    await sub.save();
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ error: 'Error creating manual invitee.' });
  }
};

export const getSubmissionsList = async (req, res) => {
  const { programId, status, attendance, paymentStatus, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 50 } = req.query;
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safePage = Math.max(1, Number(page) || 1);

  const query = { isDeleted: { $ne: true } };

  if (programId && programId !== 'all') query.programId = programId;
  if (status && status !== 'all') query.status = status;
  if (paymentStatus && paymentStatus !== 'all') {
    if (paymentStatus === 'paid' || paymentStatus === 'captured') {
      query.$or = [
        { 'payment.status': 'captured' },
        { status: 'approved' }
      ];
    } else if (paymentStatus === 'pending') {
      query.$and = [
        { $or: [{ 'payment.status': 'pending' }, { 'payment.status': { $exists: false } }, { payment: null }] },
        { status: { $ne: 'approved' } }
      ];
    } else if (paymentStatus === 'failed') {
      query['payment.status'] = 'failed';
    }
  }
  if (attendance && attendance !== 'all') {
    if (attendance === 'unmarked') {
      query.$or = [{ attendance: 'unmarked' }, { attendance: { $exists: false } }, { attendance: null }];
    } else {
      query.attendance = attendance;
    }
  }

  if (search) {
    const searchConditions = [
      { inquiryId: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } },
      { husbandName: { $regex: search, $options: 'i' } },
      { wifeName: { $regex: search, $options: 'i' } },
      { surname: { $regex: search, $options: 'i' } }
    ];
    if (query.$or) {
      query.$and = (query.$and || []).concat([{ $or: searchConditions }]);
    } else {
      query.$or = searchConditions;
    }
  }

  try {
    const skip = (safePage - 1) * safeLimit;
    const sortField = sortBy === 'inquiryId' ? 'inquiryId' : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [submissions, total] = await Promise.all([
      Registration.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Registration.countDocuments(query)
    ]);

    // Batch resolve media storage status for fast Admin UI rendering
    const inquiryIds = submissions.map(s => s.inquiryId);
    const { MediaArchive } = await import('../../models/MediaArchive.js');
    const archives = await MediaArchive.find({
      registrationId: { $in: inquiryIds },
      status: { $in: ['VERIFIED', 'ARCHIVED', 'QUEUED', 'COPYING'] }
    }).select('registrationId status driveFileId filename operationalThumbnailUrl operationalThumbnailPublicId cloudinaryOriginalStatus').lean();

    const archiveMap = new Map();
    archives.forEach(a => archiveMap.set(a.registrationId, a));

    const enrichedSubmissions = submissions.map(sub => {
      const archive = archiveMap.get(sub.inquiryId);
      const isArchived = archive && (archive.status === 'VERIFIED' || archive.status === 'ARCHIVED');
      const isQueued = archive && (archive.status === 'QUEUED' || archive.status === 'COPYING');
      const isOriginalDeleted = archive && archive.cloudinaryOriginalStatus === 'DELETED';
      const rawPhoto = sub.couplePhoto || '';

      let photoThumbnailUrl = '';
      if (archive?.operationalThumbnailUrl) {
        photoThumbnailUrl = archive.operationalThumbnailUrl;
      } else if (rawPhoto.includes('cloudinary.com') && rawPhoto.includes('/upload/') && !rawPhoto.includes('/archive-thumbnails/')) {
        photoThumbnailUrl = rawPhoto.replace('/upload/', '/upload/c_limit,w_400,q_auto,f_auto/');
      } else {
        photoThumbnailUrl = rawPhoto;
      }

      let couplePhoto = rawPhoto;
      if (isOriginalDeleted && archive?.operationalThumbnailUrl) {
        couplePhoto = archive.operationalThumbnailUrl;
      }

      const isOldEvent = sub.programDate?.startsWith('2026-08') || sub.inquiryId?.startsWith('EK05') || sub.inquiryId?.startsWith('IP') || sub.inquiryId?.startsWith('EK01') || sub.inquiryId?.startsWith('EK02') || sub.inquiryId?.startsWith('EK03') || sub.inquiryId?.startsWith('EK04');
      const defaultAmount = isOldEvent ? 1000 : 1500;
      const paymentObj = sub.payment ? {
        ...sub.payment,
        amount: sub.payment.amount !== undefined ? sub.payment.amount : defaultAmount
      } : {
        provider: 'legacy_upi',
        status: sub.status === 'approved' ? 'captured' : 'pending',
        amount: defaultAmount,
        currency: 'INR'
      };

      return {
        ...sub,
        payment: paymentObj,
        amount: paymentObj.amount,
        couplePhoto,
        photoThumbnailUrl,
        photoStorageStatus: isArchived ? 'ARCHIVED' : (isQueued ? 'QUEUED' : 'ACTIVE'),
        hasArchivedOriginal: Boolean(isArchived && archive.driveFileId),
        archiveStatus: archive ? archive.status : null,
        cloudinaryOriginalStatus: archive?.cloudinaryOriginalStatus || 'ACTIVE'
      };
    });

    res.json({
      submissions: enrichedSubmissions,
      totalSubmissions: total,
      total,
      currentPage: safePage,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit) || 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching submissions.' });
  }
};

export const getDuplicateSubmissions = async (req, res) => {
  try {
    const allSubs = await Registration.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean();
    
    const phoneMap = new Map();
    const nameMap = new Map();

    allSubs.forEach(sub => {
      // Group by phone
      if (sub.phoneNumber) {
        const phone = sub.phoneNumber.trim();
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone).push(sub);
      }

      // Group by couple name
      const nameKey = `${(sub.husbandName || '').trim().toLowerCase()}_${(sub.wifeName || '').trim().toLowerCase()}`;
      if (nameKey.length > 3) {
        if (!nameMap.has(nameKey)) nameMap.set(nameKey, []);
        nameMap.get(nameKey).push(sub);
      }
    });

    const duplicateGroups = [];
    let groupId = 1;

    phoneMap.forEach((subs, phone) => {
      if (subs.length > 1) {
        duplicateGroups.push({
          id: `phone_${groupId++}`,
          type: 'phone',
          label: `Same Phone: ${phone}`,
          submissions: subs
        });
      }
    });

    res.json(duplicateGroups);
  } catch (err) {
    res.status(500).json({ error: 'Server error finding duplicates.' });
  }
};

export const getTrashSubmissions = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const safeLimit = Math.max(1, Number(limit) || 10);
  const safePage = Math.max(1, Number(page) || 1);

  try {
    const skip = (safePage - 1) * safeLimit;
    const query = { isDeleted: true };
    const [submissions, total] = await Promise.all([
      Registration.find(query).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Registration.countDocuments(query)
    ]);

    res.json({
      submissions,
      totalSubmissions: total,
      currentPage: safePage,
      totalPages: Math.ceil(total / safeLimit) || 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching trash.' });
  }
};

export const restoreSubmission = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    await Registration.updateOne({ inquiryId }, { $set: { isDeleted: false } });
    res.json({ success: true, message: 'Submission restored.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error restoring submission.' });
  }
};

export const permanentDeleteSubmission = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    await Registration.deleteOne({ inquiryId });
    res.json({ success: true, message: 'Submission permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error permanently deleting submission.' });
  }
};

export const softDeleteSubmission = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    await Registration.updateOne({ inquiryId }, { $set: { isDeleted: true } });
    res.json({ success: true, message: 'Submission moved to trash.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting submission.' });
  }
};

export const updateSubmission = async (req, res) => {
  const { inquiryId } = req.params;
  const updateData = req.body;
  try {
    const updated = await Registration.findOneAndUpdate({ inquiryId }, { $set: updateData }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Submission not found.' });
    res.json({ success: true, submission: updated });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating submission.' });
  }
};

export const bulkDeleteSubmissions = async (req, res) => {
  const { inquiryIds } = req.body;
  if (!Array.isArray(inquiryIds) || inquiryIds.length === 0) {
    return res.status(400).json({ error: 'No inquiry IDs provided.' });
  }

  try {
    await Registration.updateMany(
      { inquiryId: { $in: inquiryIds } },
      { $set: { isDeleted: true } }
    );
    res.json({ success: true, count: inquiryIds.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting submissions.' });
  }
};

/**
 * Direct CDN Redirects for Media (Prevents Render Bandwidth Proxying)
 */
export const getCouplePhotoRedirect = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const sub = await Registration.findOne({ inquiryId }, { couplePhoto: 1 }).lean();
    if (!sub || !sub.couplePhoto) {
      return res.redirect(302, '/sample_couple.png');
    }
    if (sub.couplePhoto.startsWith('http://') || sub.couplePhoto.startsWith('https://')) {
      return res.redirect(302, sub.couplePhoto);
    }
    return res.redirect(302, '/sample_couple.png');
  } catch (err) {
    res.status(500).json({ error: 'Error redirecting to photo.' });
  }
};

export const getPaymentScreenshotRedirect = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const sub = await Registration.findOne({ inquiryId }, { paymentScreenshot: 1 }).lean();
    if (!sub || !sub.paymentScreenshot) {
      return res.status(404).json({ error: 'Screenshot not found.' });
    }
    if (sub.paymentScreenshot.startsWith('http://') || sub.paymentScreenshot.startsWith('https://')) {
      return res.redirect(302, sub.paymentScreenshot);
    }
    return res.status(404).json({ error: 'Screenshot not available.' });
  } catch (err) {
    res.status(500).json({ error: 'Error redirecting to screenshot.' });
  }
};
