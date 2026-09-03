import crypto from 'crypto';
import { registrationService } from './registration.service.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { MediaArchive } from '../../models/MediaArchive.js';
import { eventService } from '../events/event.service.js';
import { Counter, getNextSequence } from '../../models/Counter.js';
import { storageService } from '../../services/storage.service.js';
import { qrPassService } from '../passes/qrPass.service.js';
import { invitationCardService } from '../../services/invitationCard.service.js';
import { sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';

export const submitRegistration = async (req, res) => {
  const { husbandName, wifeName, surname, phoneNumber, programId, whatsappOptIn } = req.body;
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
      couplePhotoFile,
      whatsappOptIn: whatsappOptIn === true || whatsappOptIn === 'true' || whatsappOptIn === 'on'
    });

    res.status(200).json({
      success: true,
      message: result.earlyRegistration
        ? 'Early registration received successfully. Online payment will open shortly.'
        : 'Registration created successfully. Please proceed with payment.',
      inquiryId: result.inquiryId,
      customerToken: result.customerToken,
      amount: result.amount,
      programName: result.programName,
      earlyRegistration: Boolean(result.earlyRegistration),
      isPaymentEnabled: Boolean(result.isPaymentEnabled)
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

  const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
  }

  try {
    const program = await Event.findOne({
      $or: [{ id: programId }, { slug: programId }, { date: programId }]
    });
    if (!program) return res.status(404).json({ error: 'Program not found.' });

    const progIdentifiers = [program.id, program.slug, program.date].filter(Boolean);
    const eventFilter = {
      $or: [
        { programId: { $in: progIdentifiers } },
        ...(program.date ? [{ programDate: program.date }] : [])
      ]
    };

    // Duplicate check for VIP / manual invite
    const existing = await Registration.findOne({
      phoneNumber: { $in: [cleanPhone, `91${cleanPhone}`, `+91${cleanPhone}`] },
      ...eventFilter,
      status: { $ne: 'rejected' },
      isDeleted: { $ne: true }
    });

    if (existing) {
      return res.status(400).json({
        error: `This mobile number is already registered for this event date (${existing.inquiryId}).`
      });
    }

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
      phoneNumber: cleanPhone,
      isVip: true,
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

    // Authoritative Cryptographic Pass Generation for VIP Guest (Async Non-Blocking)
    qrPassService.ensurePass(sub, program)
      .then(async () => {
        const customerName = `${husbandName} & ${wifeName}`.trim();
        // Generate personalized invitation card for VIP (pass & invitation message, NO payment confirmation)
        let headerImageUrl = sub.couplePhoto || 'https://www.ekdujekeliye.in/sample_couple.png';
        try {
          const cardRes = await invitationCardService.ensureInvitationCard(sub, program);
          if (cardRes && cardRes.cardUrl) {
            headerImageUrl = cardRes.cardUrl;
          }
        } catch (cardErr) {
          console.warn('[ManualInvitee] Invitation card generation warning:', cardErr.message);
        }

        return sendUtilityTemplate({
          recipientPhone: phoneNumber,
          templateKey: 'edkl_personal_invitation_24h_v2',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName: program.name || 'Ek Duje Ke Liye Seminar',
            eventDate: program.date || 'TBD',
            eventTime: program.time || '8:30 PM',
            venue: program.venue || 'Sardar Smruti Bhavan, Surat',
            registrationId: inquiryId,
            inquiryId,
            headerImageUrl
          },
          idempotencyKey: `VIP_INVITATION_PASS:${sub._id}:${inquiryId}`,
          registrationId: sub._id,
          eventId: program.id,
          inquiryId,
          trigger: 'vip_invitation_pass'
        });
      })
      .catch(passErr => console.warn('[ManualInvitee] Background Pass or WhatsApp notice:', passErr.message));

    res.json({ success: true, data: sub });
  } catch (err) {
    console.error('[ManualInvitee] Error creating manual invitee:', err);
    res.status(500).json({ error: 'Error creating manual invitee.' });
  }
};


export const getSubmissionsList = async (req, res) => {
  const { programId, status, attendance, paymentStatus, isVip, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 50 } = req.query;
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safePage = Math.max(1, Number(page) || 1);

  const andConditions = [
    { isDeleted: { $ne: true } }
  ];

  if (isVip === 'true') {
    andConditions.push({
      $or: [
        { isVip: true },
        { inquiryId: { $regex: '^IP-', $options: 'i' } },
        { 'payment.provider': 'manual_invite' }
      ]
    });
  } else if (isVip === 'false') {
    andConditions.push({
      isVip: { $ne: true },
      inquiryId: { $not: /^IP-/i }
    });
  }

  if (programId && programId !== 'all') {
    const eventObj = await eventService.getEventBySlug(programId) || await Event.findOne(
      { $or: [{ id: programId }, { slug: programId }, { date: programId }] },
      'id slug date isDateFinal status'
    ).lean();

    const isTbdFilter = Boolean(
      programId.toLowerCase() === 'tbd' ||
      programId.toLowerCase() === 'tba' ||
      (eventObj && (eventObj.isDateFinal === false || eventObj.status === 'date_tba' || eventObj.date === 'TBD' || eventObj.date === 'TBA'))
    );

    const matchedIds = [programId];
    if (eventObj) {
      if (eventObj.id && !matchedIds.includes(eventObj.id)) matchedIds.push(eventObj.id);
      if (eventObj.slug && !matchedIds.includes(eventObj.slug)) matchedIds.push(eventObj.slug);
    }
    if (isTbdFilter) {
      ['TBD', 'TBA', 'tbd', 'tba'].forEach(id => {
        if (!matchedIds.includes(id)) matchedIds.push(id);
      });
    }

    andConditions.push({
      $or: [
        { programId: { $in: matchedIds } },
        ...(eventObj?.date ? [{ programDate: eventObj.date }] : []),
        ...(isTbdFilter ? [{ programDate: { $in: ['TBD', 'TBA', 'tbd', 'tba'] } }] : [])
      ]
    });
  }

  if (status && status !== 'all') {
    andConditions.push({ status });
  }

  if (paymentStatus && paymentStatus !== 'all') {
    if (paymentStatus === 'paid' || paymentStatus === 'captured') {
      andConditions.push({
        $or: [
          { 'payment.status': 'captured' },
          { status: 'approved' }
        ]
      });
    } else if (paymentStatus === 'pending') {
      andConditions.push({
        'payment.status': { $in: ['pending', null, undefined] },
        status: { $ne: 'approved' }
      });
    } else if (paymentStatus === 'failed') {
      andConditions.push({ 'payment.status': 'failed' });
    }
  }

  if (attendance && attendance !== 'all') {
    if (attendance === 'unmarked') {
      andConditions.push({
        $or: [{ attendance: 'unmarked' }, { attendance: { $exists: false } }, { attendance: null }]
      });
    } else {
      andConditions.push({ attendance });
    }
  }

  if (search) {
    andConditions.push({
      $or: [
        { inquiryId: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { husbandName: { $regex: search, $options: 'i' } },
        { wifeName: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } }
      ]
    });
  }

  const { frameExportStatus } = req.query;
  if (frameExportStatus && frameExportStatus !== 'all') {
    if (frameExportStatus === 'NOT_EXPORTED') {
      andConditions.push({
        $or: [
          { frameExportStatus: 'NOT_EXPORTED' },
          { frameExportStatus: { $exists: false } },
          { frameExportStatus: null }
        ]
      });
    } else {
      andConditions.push({ frameExportStatus });
    }
  }

  const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

  try {
    const skip = (safePage - 1) * safeLimit;
    const sortField = sortBy === 'inquiryId' ? 'inquiryId' : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [submissions, total] = await Promise.all([
      Registration.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(safeLimit)
        .select('-paymentScreenshot')
        .lean(),
      Registration.countDocuments(query)
    ]);

    // Batch resolve media storage status for fast Admin UI rendering
    const inquiryIds = submissions.map(s => s.inquiryId);
    const archives = inquiryIds.length > 0 ? await MediaArchive.find({
      registrationId: { $in: inquiryIds },
      status: { $in: ['VERIFIED', 'ARCHIVED', 'QUEUED', 'COPYING'] }
    }).select('registrationId status driveFileId filename operationalThumbnailUrl operationalThumbnailPublicId cloudinaryOriginalStatus').lean() : [];

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
      success: true,
      data: enrichedSubmissions,
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

    nameMap.forEach((subs, nameKey) => {
      if (subs.length > 1) {
        // Only add if not all submissions in this group already have the same phone
        const distinctPhones = new Set(subs.map(s => String(s.phoneNumber || '').replace(/\D/g, '').slice(-10)));
        if (distinctPhones.size > 1) {
          const first = subs[0];
          duplicateGroups.push({
            id: `couple_${groupId++}`,
            type: 'couple',
            label: `Same Couple (${first.husbandName} & ${first.wifeName} ${first.surname || ''}) - Different Phones`,
            submissions: subs
          });
        }
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
  const updateData = { ...req.body };
  try {
    const cleanInquiryId = inquiryId.trim().toUpperCase();
    const existing = await Registration.findOne({
      $or: [
        { inquiryId: cleanInquiryId, isDeleted: { $ne: true } },
        { inquiryId: inquiryId.trim(), isDeleted: { $ne: true } },
        { inquiryId: cleanInquiryId }
      ]
    });
    if (!existing) return res.status(404).json({ error: 'Submission not found.' });


    // If transferring event, automatically cascade event name, date, and timing
    if (updateData.programId && updateData.programId !== existing.programId) {
      const eventObj = await eventService.getEventBySlug(updateData.programId) || await Event.findOne({
        $or: [{ id: updateData.programId }, { slug: updateData.programId }, { date: updateData.programId }]
      }).lean();

      if (eventObj) {
        updateData.programId = eventObj.id || updateData.programId;
        updateData.programName = eventObj.name;
        updateData.programDate = eventObj.date;
        updateData.programTime = eventObj.time;
      }
    }

    // Handle payment status adjustments
    if (updateData.paymentStatus === 'captured' || updateData.status === 'approved') {
      if (!existing.payment) {
        updateData.payment = {
          provider: 'manual',
          status: 'captured',
          amount: updateData.paymentAmount || existing.payment?.amount || 1500,
          currency: 'INR',
          paidAt: new Date()
        };
      } else {
        updateData['payment.status'] = 'captured';
        if (updateData.paymentAmount) {
          updateData['payment.amount'] = Number(updateData.paymentAmount);
        }
        if (!existing.payment.paidAt) {
          updateData['payment.paidAt'] = new Date();
        }
      }
    } else if (updateData.paymentStatus === 'pending' || updateData.paymentStatus === 'unpaid') {
      if (existing.payment) {
        updateData['payment.status'] = 'created';
      }
    }

    // Handle new photo upload if provided
    const couplePhotoFile = req.files && req.files['couplePhoto'] ? req.files['couplePhoto'][0] : null;
    if (couplePhotoFile && couplePhotoFile.buffer) {
      const base64Data = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
      const couplePhotoUrl = await storageService.upload({
        data: base64Data,
        folder: 'couplePhotos',
        filename: `${existing.inquiryId}_couple`
      });
      updateData.couplePhoto = couplePhotoUrl;
    }

    // If photo or framing alignment is modified after export, mark as MODIFIED so admin knows it needs reprint
    if (updateData.photoZoom !== undefined || updateData.photoOffsetY !== undefined || updateData.couplePhoto) {
      if (existing.frameExportStatus === 'EXPORTED') {
        updateData.frameExportStatus = 'MODIFIED';
      }
    }

    const updated = await Registration.findOneAndUpdate(
      { _id: existing._id },
      { $set: updateData },
      { returnDocument: 'after' }
    );



    res.json({ success: true, submission: updated });
  } catch (err) {
    console.error('[Registration Controller] Error updating submission:', err);
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

export const markFramesExported = async (req, res) => {
  const { inquiryIds, batchNumber } = req.body;
  if (!Array.isArray(inquiryIds) || inquiryIds.length === 0) {
    return res.status(400).json({ error: 'No inquiry IDs provided.' });
  }

  try {
    const updatePayload = {
      frameExportStatus: 'EXPORTED',
      frameExportedAt: new Date()
    };
    if (batchNumber !== undefined) {
      updatePayload.frameExportBatch = Number(batchNumber);
    }

    const result = await Registration.updateMany(
      { inquiryId: { $in: inquiryIds } },
      { $set: updatePayload }
    );

    res.json({
      success: true,
      modifiedCount: result.modifiedCount || inquiryIds.length,
      exportedAt: updatePayload.frameExportedAt
    });
  } catch (err) {
    console.error('[Registration Controller] Error marking frames exported:', err);
    res.status(500).json({ error: 'Server error marking frames exported.' });
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
