import mongoose from 'mongoose';
import { verifyWebhook, handleWebhookEvent, sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';
import { WhatsappTemplate } from '../../models/WhatsappTemplate.js';
import { CORE_TEMPLATES } from '../../integrations/whatsapp/templateRegistry.js';
import { Registration } from '../../models/Registration.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../../models/WhatsappMessage.js';
import { Pass } from '../../models/Pass.js';
import { Event } from '../../models/Event.js';
import { communicationSchedulerService } from '../../services/communicationScheduler.service.js';
import { invitationCardService } from '../../services/invitationCard.service.js';

export const handleVerification = verifyWebhook;
export const handleEvents = handleWebhookEvent;

/**
 * Get all official Meta approved WhatsApp templates configured in system
 */
export const getMetaTemplates = async (req, res) => {
  try {
    const list = Object.values(CORE_TEMPLATES).map((tpl) => {
      const bodyComp = tpl.components?.find((c) => c.type === 'BODY');
      const buttonComp = tpl.components?.find((c) => c.type === 'BUTTONS');
      const buttons = buttonComp?.buttons || [];

      return {
        key: tpl.key,
        metaName: tpl.metaName,
        category: tpl.category || 'UTILITY',
        language: tpl.language || 'en_US',
        purpose: tpl.purpose || '',
        trigger: tpl.trigger || '',
        bodyText: bodyComp?.text || '',
        buttons: buttons.map((b) => ({
          type: b.type,
          text: b.text,
          url: b.url
        })),
        requiredVariables: tpl.requiredVariables || [],
        status: 'APPROVED',
        channel: 'Meta WhatsApp Cloud API'
      };
    });

    res.json({ success: true, metaTemplates: list });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching Meta templates.' });
  }
};

/**
 * Send a test or real Meta WhatsApp template message
 */
export const sendTestMessage = async (req, res) => {
  const { recipientPhone, templateKey, submissionId, customVariables } = req.body;

  const tplKey = templateKey || 'edkl_payment_pending_v1';
  let cleanPhone = recipientPhone ? recipientPhone.replace(/\D/g, '') : '';

  try {
    let targetRegistration = null;
    if (submissionId) {
      targetRegistration = await Registration.findOne({
        $or: [
          ...(mongoose.isValidObjectId(submissionId) ? [{ _id: submissionId }] : []),
          { inquiryId: submissionId }
        ]
      });
    }

    if (!cleanPhone && targetRegistration?.phoneNumber) {
      cleanPhone = targetRegistration.phoneNumber.replace(/\D/g, '');
    }

    if (!cleanPhone) {
      return res.status(400).json({ error: 'Recipient phone number or registered couple is required.' });
    }

    const customerName = targetRegistration
      ? `${targetRegistration.husbandName} & ${targetRegistration.wifeName} ${targetRegistration.surname || ''}`.trim()
      : customVariables?.customerName || 'Jaynesh & Partner';

    const eventName = targetRegistration?.programName || customVariables?.eventName || 'Ek Duje Ke Liye Seminar';
    const registrationId = targetRegistration?.inquiryId || customVariables?.registrationId || 'TEST-01';
    const eventDate = targetRegistration?.programDate || customVariables?.eventDate || '15 September 2026';
    const eventTime = targetRegistration?.programTime || customVariables?.eventTime || '8:30 PM';
    const venue = targetRegistration?.programVenue || customVariables?.venue || 'Sardar Smruti Bhavan, Surat';
    const feeAmount = targetRegistration?.payment?.amount
      ? `₹${targetRegistration.payment.amount}`
      : customVariables?.feeAmount || '₹1500';
    const inquiryId = targetRegistration?.inquiryId || customVariables?.inquiryId || 'TEST-01';

    const result = await sendUtilityTemplate({
      recipientPhone: cleanPhone,
      templateKey: tplKey,
      languageCode: 'en_US',
      variables: {
        customerName,
        eventName,
        registrationId,
        eventDate,
        eventTime,
        venue,
        feeAmount,
        inquiryId,
        statusText: 'Payment Confirmed'
      },
      idempotencyKey: `MANUAL_${targetRegistration ? 'REAL' : 'TEST'}:${tplKey}:${cleanPhone}:${Date.now()}`,
      trigger: targetRegistration ? 'manual_admin_resend' : 'manual_admin_test',
      registrationId: targetRegistration?._id,
      inquiryId: targetRegistration?.inquiryId
    });

    if (result.success) {
      return res.json({
        success: true,
        message: `WhatsApp message '${tplKey}' sent successfully to ${cleanPhone} (${customerName})!`,
        data: result
      });
    } else {
      return res.status(400).json({ error: result.error || 'Failed to dispatch WhatsApp message.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error sending WhatsApp message.' });
  }
};

/**
 * Get recent WhatsApp dispatch logs
 */
export const getWhatsappLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const eventId = req.query.eventId ? String(req.query.eventId).trim() : null;
    const includeMock = req.query.includeMock === 'true';

    const filter = {};
    if (eventId && eventId !== 'all') {
      filter.eventId = eventId;
    }
    if (!includeMock) {
      filter.providerMode = { $ne: 'MOCK' };
      filter.executionSource = { $ne: 'AUTOMATED_TEST' };
      filter.providerMessageId = { $not: /^wamid\.MOCK_TEST_/ };
      filter.recipientPhone = { $ne: '919999999999' };
    }

    const logs = await WhatsappMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching WhatsApp logs.' });
  }
};

export const getTemplates = async (req, res) => {
  try {
    const templates = await WhatsappTemplate.find({});
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching templates.' });
  }
};

export const createTemplate = async (req, res) => {
  const { name, text, type } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Name and text are required.' });

  try {
    const activeType = type || 'pass_delivery';
    const count = await WhatsappTemplate.countDocuments({ type: activeType });
    const template = await WhatsappTemplate.create({
      name,
      text,
      type: activeType,
      isActive: count === 0
    });
    res.status(201).json({ success: true, template });
  } catch (err) {
    res.status(500).json({ error: 'Server error creating template.' });
  }
};

export const activateTemplate = async (req, res) => {
  const { id } = req.params;
  try {
    const target = await WhatsappTemplate.findById(id);
    if (!target) return res.status(404).json({ error: 'Template not found.' });

    await WhatsappTemplate.updateMany({ type: target.type }, { isActive: false });
    target.isActive = true;
    await target.save();

    res.json({ success: true, message: 'Template activated.', template: target });
  } catch (err) {
    res.status(500).json({ error: 'Server error activating template.' });
  }
};

export const getActiveTemplate = async (req, res) => {
  const activeType = req.query.type || 'pass_delivery';
  try {
    const activeTemplate = await WhatsappTemplate.findOne({ type: activeType, isActive: true });
    if (!activeTemplate) {
      if (activeType === 'payment_request') {
        return res.json({ text: 'Hello! I have registered for {programName}. My Inquiry ID is {inquiryId}. Please verify my pass.' });
      }
      return res.json({ text: 'Hello! Your pass for {programName} is ready: {passUrl}' });
    }
    res.json(activeTemplate);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching active template.' });
  }
};

/**
 * Get complete communication timeline for a specific registration
 */
export const getRegistrationTimeline = async (req, res) => {
  const { inquiryId } = req.params;
  if (!inquiryId) return res.status(400).json({ error: 'Inquiry ID is required.' });

  try {
    const reg = await Registration.findOne({ inquiryId: { $regex: new RegExp(`^${inquiryId.trim()}$`, 'i') } }).lean();
    if (!reg) return res.status(404).json({ error: 'Registration not found.' });

    const pass = await Pass.findOne({ registrationId: reg._id }).lean();

    const messages = await WhatsappMessage.find({
      $or: [
        { inquiryId: reg.inquiryId },
        { registrationId: reg._id }
      ]
    }).sort({ createdAt: 1 }).lean();

    const totals = {
      attempted: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0,
      paymentReminders: 0,
      manualBroadcasts: 0
    };

    const timeline = messages.map(m => {
      const status = m.status || 'QUEUED';
      if (status === 'SENT' || status === 'DELIVERED' || status === 'READ') totals.sent++;
      if (status === 'DELIVERED' || status === 'READ') totals.delivered++;
      if (status === 'READ') totals.read++;
      if (status === 'FAILED') totals.failed++;
      if (status === 'QUEUED' || status === 'SENDING') totals.pending++;
      if (m.messageType === 'payment_pending') totals.paymentReminders++;
      if (m.trigger === 'manual_broadcast' || m.trigger === 'manual_admin_resend') totals.manualBroadcasts++;
      totals.attempted++;

      return {
        id: m._id,
        messageId: m.messageId,
        templateName: m.templateName,
        messageType: m.messageType,
        templateLanguage: m.templateLanguage || 'en_US',
        templateCategory: m.templateCategory || 'UTILITY',
        trigger: m.trigger,
        status: m.status,
        attemptCount: m.attemptCount || 0,
        maxAttempts: m.maxAttempts || 3,
        scheduledFor: m.scheduledFor,
        sentAt: m.sentAt,
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
        failedAt: m.failedAt,
        providerErrorCode: m.providerErrorCode,
        providerErrorMessage: m.providerErrorMessage,
        lastErrorCode: m.lastErrorCode,
        lastErrorMessage: m.lastErrorMessage,
        providerMessageId: m.providerMessageId,
        executionSource: m.executionSource,
        providerMode: m.providerMode,
        createdAt: m.createdAt
      };
    });

    const isPaid = reg.payment?.status === 'captured' || reg.status === 'approved';
    const isPresent = reg.attendance === 'PRESENT' || reg.attendance === 'present' || reg.attendance === true;

    res.json({
      success: true,
      inquiryId: reg.inquiryId,
      customerName: `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim(),
      phoneNumberMasked: reg.phoneNumber ? reg.phoneNumber.replace(/(\d{4})\d{4}(\d{2})/, '$1****$2') : '',
      paymentStatus: isPaid ? 'PAID' : (reg.payment?.status === 'failed' ? 'FAILED' : 'PENDING'),
      passStatus: pass?.status || 'NONE',
      passId: pass?.passId || null,
      whatsappOptIn: reg.whatsappOptIn !== false,
      attendance: isPresent ? 'PRESENT' : 'ABSENT',
      invitationVersion: reg.invitationVersion || 1,
      totals,
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching communication timeline.', details: err.message });
  }
};

/**
 * Get Event Communication Dashboard Overview & Aggregate Metrics (Zero N+1)
 */
export const getEventCommunicationDashboard = async (req, res) => {
  const { eventId } = req.params;
  if (!eventId) return res.status(400).json({ error: 'Event ID is required.' });

  try {
    const event = await Event.findOne({ $or: [{ id: eventId }, { slug: eventId }] }).lean();

    const [
      totalRegistrations,
      confirmedRegistrations,
      paymentPendingRegistrations,
      whatsappOptInRegistrations,
      whatsappOptOutRegistrations,
      attendedRegistrations
    ] = await Promise.all([
      Registration.countDocuments({ programId: eventId, isDeleted: false }),
      Registration.countDocuments({ programId: eventId, status: 'approved', isDeleted: false }),
      Registration.countDocuments({ programId: eventId, status: { $in: ['pending', 'inquiry'] }, isDeleted: false }),
      Registration.countDocuments({ programId: eventId, whatsappOptIn: true, isDeleted: false }),
      Registration.countDocuments({ programId: eventId, whatsappOptIn: false, isDeleted: false }),
      Registration.countDocuments({
        programId: eventId,
        status: 'approved',
        $or: [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }]
      })
    ]);

    // Aggregate message counts grouped by messageType and status
    const breakdown = await WhatsappMessage.aggregate([
      { $match: { eventId } },
      {
        $group: {
          _id: { messageType: '$messageType', status: '$status' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Top aggregate counters
    let totalMessagesAttempted = 0;
    let totalMessagesSent = 0;
    let totalMessagesDelivered = 0;
    let totalMessagesRead = 0;
    let totalMessagesFailed = 0;
    let totalMessagesScheduled = 0;

    const messageTypeStats = {
      registration_received: { eligible: totalRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      payment_pending: { eligible: paymentPendingRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      payment_confirmation: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      pass_delivery: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      invitation: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      reminder: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      feedback_request: { eligible: attendedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      gallery_ready: { eligible: attendedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      event_update: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      event_cancelled: { eligible: totalRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      pass_reissued: { eligible: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      custom: { eligible: totalRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 }
    };

    breakdown.forEach(item => {
      const type = item._id?.messageType;
      const status = item._id?.status;
      const count = item.count || 0;

      totalMessagesAttempted += count;

      if (status === 'SENT' || status === 'DELIVERED' || status === 'READ') {
        totalMessagesSent += count;
      }
      if (status === 'DELIVERED' || status === 'READ') {
        totalMessagesDelivered += count;
      }
      if (status === 'READ') {
        totalMessagesRead += count;
      }
      if (status === 'FAILED') {
        totalMessagesFailed += count;
      }
      if (status === 'QUEUED' || status === 'SENDING') {
        totalMessagesScheduled += count;
      }

      if (messageTypeStats[type]) {
        if (status === 'QUEUED' || status === 'SENDING') messageTypeStats[type].queued += count;
        if (status === 'SENT' || status === 'DELIVERED' || status === 'READ') messageTypeStats[type].sent += count;
        if (status === 'DELIVERED' || status === 'READ') messageTypeStats[type].delivered += count;
        if (status === 'READ') messageTypeStats[type].read += count;
        if (status === 'FAILED') messageTypeStats[type].failed += count;
      }
    });

    // Calculate rates
    Object.keys(messageTypeStats).forEach(type => {
      const s = messageTypeStats[type];
      s.deliveryRate = s.sent > 0 ? Math.round((s.delivered / s.sent) * 100) : 0;
      s.readRate = s.delivered > 0 ? Math.round((s.read / s.delivered) * 100) : 0;
      s.failureRate = (s.sent + s.failed) > 0 ? Math.round((s.failed / (s.sent + s.failed)) * 100) : 0;
    });

    const deliveryRate = totalMessagesSent > 0 ? Math.round((totalMessagesDelivered / totalMessagesSent) * 100) : 0;
    const readRate = totalMessagesDelivered > 0 ? Math.round((totalMessagesRead / totalMessagesDelivered) * 100) : 0;
    const failureRate = totalMessagesAttempted > 0 ? Math.round((totalMessagesFailed / totalMessagesAttempted) * 100) : 0;

    // Count registrations needing action (e.g. failed messages)
    const actionNeededCount = await WhatsappMessage.distinct('registrationId', {
      eventId,
      status: 'FAILED'
    }).then(ids => ids.filter(Boolean).length);

    res.json({
      success: true,
      eventId,
      eventName: event?.name || 'Ek Duje Ke Liye Seminar',
      eventDate: event?.date || '',
      eventTime: event?.time || '',
      venue: event?.venue || '',
      summary: {
        totalRegistrations,
        confirmedRegistrations,
        paymentPendingRegistrations,
        whatsappOptIn: whatsappOptInRegistrations,
        whatsappOptOut: whatsappOptOutRegistrations,
        attendedRegistrations,
        totalMessagesAttempted,
        totalMessagesSent,
        totalMessagesDelivered,
        totalMessagesRead,
        totalMessagesFailed,
        totalMessagesScheduled,
        actionNeededCount,
        deliveryRate,
        readRate,
        failureRate
      },
      messageTypeStats,
      eventSettings: {
        registrationMessage: true,
        paymentPendingReminder: true,
        paymentConfirmation: true,
        invitation48h: true,
        reminder24h: true,
        feedbackRequest: true,
        galleryReady: false
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error generating communication dashboard.', details: err.message });
  }
};

/**
 * Get Per-Person Registration Communication Table (Server-side Pagination, Filters, Zero N+1)
 */
export const getEventRegistrationsCommunication = async (req, res) => {
  const { eventId } = req.params;
  if (!eventId) return res.status(400).json({ error: 'Event ID is required.' });

  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const paymentFilter = req.query.paymentStatus ? String(req.query.paymentStatus).toUpperCase() : 'ALL';
    const attendanceFilter = req.query.attendance ? String(req.query.attendance).toUpperCase() : 'ALL';
    const messageStatusFilter = req.query.messageStatus ? String(req.query.messageStatus).toUpperCase() : 'ALL';
    const messageTypeFilter = req.query.messageType ? String(req.query.messageType).toLowerCase() : 'ALL';
    const healthFilter = req.query.health ? String(req.query.health).toUpperCase() : 'ALL';

    const event = await Event.findOne({ $or: [{ id: eventId }, { slug: eventId }] }).lean();

    const matchQuery = {
      programId: eventId,
      isDeleted: false
    };

    if (search) {
      matchQuery.$or = [
        { husbandName: { $regex: search, $options: 'i' } },
        { wifeName: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { inquiryId: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (paymentFilter === 'PAID') {
      matchQuery.status = 'approved';
    } else if (paymentFilter === 'PENDING') {
      matchQuery.status = { $in: ['pending', 'inquiry'] };
    } else if (paymentFilter === 'FAILED') {
      matchQuery['payment.status'] = 'failed';
    }

    if (attendanceFilter === 'PRESENT') {
      matchQuery.$or = [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }];
    } else if (attendanceFilter === 'ABSENT') {
      matchQuery.$or = [{ attendance: 'ABSENT' }, { attendance: 'absent' }, { attendance: false }, { attendance: 'unmarked' }];
    }

    const totalRegistrations = await Registration.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRegistrations / limit) || 1;

    const registrations = await Registration.find(matchQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const regIds = registrations.map(r => r._id);
    const inquiryIds = registrations.map(r => r.inquiryId);

    // Fetch passes in batch
    const passes = await Pass.find({ registrationId: { $in: regIds } }).lean();
    const passMap = new Map();
    passes.forEach(p => passMap.set(String(p.registrationId), p));

    // Fetch messages in batch
    const messages = await WhatsappMessage.find({
      $or: [
        { registrationId: { $in: regIds } },
        { inquiryId: { $in: inquiryIds } }
      ]
    }).sort({ createdAt: 1 }).lean();

    const msgMap = new Map();
    messages.forEach(m => {
      const key = m.registrationId ? String(m.registrationId) : String(m.inquiryId);
      if (!msgMap.has(key)) msgMap.set(key, []);
      msgMap.get(key).push(m);
    });

    const rows = registrations.map(reg => {
      const regIdStr = String(reg._id);
      const regMsgs = msgMap.get(regIdStr) || msgMap.get(reg.inquiryId) || [];
      const pass = passMap.get(regIdStr);

      const isPaid = reg.payment?.status === 'captured' || reg.status === 'approved';
      const isPresent = reg.attendance === 'PRESENT' || reg.attendance === 'present' || reg.attendance === true;
      const optIn = reg.whatsappOptIn !== false;

      // Extract specific lifecycle messages
      const mReg = regMsgs.find(m => m.messageType === 'registration_received');
      const mPayReminders = regMsgs.filter(m => m.messageType === 'payment_pending');
      const mPayConf = regMsgs.find(m => m.messageType === 'payment_confirmation');
      const mInv = regMsgs.find(m => m.messageType === 'invitation');
      const mRem = regMsgs.find(m => m.messageType === 'reminder');
      const mFb = regMsgs.find(m => m.messageType === 'feedback_request');
      const mGal = regMsgs.find(m => m.messageType === 'gallery_ready');

      // Totals
      const totals = {
        attempted: regMsgs.length,
        sent: regMsgs.filter(m => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length,
        delivered: regMsgs.filter(m => ['DELIVERED', 'READ'].includes(m.status)).length,
        read: regMsgs.filter(m => m.status === 'READ').length,
        failed: regMsgs.filter(m => m.status === 'FAILED').length,
        pending: regMsgs.filter(m => ['QUEUED', 'SENDING'].includes(m.status)).length,
        paymentReminders: mPayReminders.length,
        manualBroadcasts: regMsgs.filter(m => m.trigger === 'manual_broadcast').length
      };

      // Last communication
      const lastMsg = regMsgs.length > 0 ? regMsgs[regMsgs.length - 1] : null;
      const lastCommunication = lastMsg ? {
        messageType: lastMsg.messageType,
        status: lastMsg.status,
        at: lastMsg.readAt || lastMsg.deliveredAt || lastMsg.sentAt || lastMsg.createdAt,
        templateName: lastMsg.templateName
      } : null;

      // Next communication
      const nextPending = regMsgs.find(m => ['QUEUED', 'SENDING'].includes(m.status) && m.scheduledFor);
      const nextCommunication = nextPending ? {
        messageType: nextPending.messageType,
        scheduledFor: nextPending.scheduledFor,
        templateName: nextPending.templateName
      } : null;

      // Deterministic Health Status
      let health = 'HEALTHY';
      if (totals.failed > 0 || (!isPaid && reg.payment?.status === 'failed')) {
        health = 'ACTION_NEEDED';
      } else if (totals.pending > 0 || (!isPaid && reg.status === 'pending')) {
        health = 'PENDING';
      }

      // Reason if missing helper
      const getReason = (type) => {
        if (!optIn) return 'WHATSAPP_OPT_OUT';
        if (!reg.phoneNumber) return 'PHONE_MISSING';
        if (type === 'payment_confirmation' || type === 'invitation' || type === 'reminder') {
          if (!isPaid) return 'PAYMENT_NOT_COMPLETE';
          if (type === 'invitation' && (!pass || pass.status !== 'ACTIVE')) return 'PASS_NOT_ACTIVE';
        }
        if (type === 'payment_reminder') {
          if (isPaid) return 'NOT_REQUIRED';
          if (event?.isPaymentEnabled === false || event?.earlyRegistrationMode === true) return 'PAYMENT_NOT_OPEN';
        }
        if (type === 'feedback' || type === 'gallery') {
          if (!isPresent) return 'NO_ATTENDANCE';
        }
        return 'NOT_YET_DUE';
      };

      const isPaymentNotOpen = Boolean(!isPaid && (event?.isPaymentEnabled === false || event?.earlyRegistrationMode === true));

      return {
        inquiryId: reg.inquiryId,
        coupleName: `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim(),
        maskedPhone: reg.phoneNumber ? reg.phoneNumber.replace(/(\d{4})\d{4}(\d{2})/, '$1****$2') : '',
        paymentStatus: isPaid ? 'PAID' : (isPaymentNotOpen ? 'NOT_OPEN_YET' : (reg.payment?.status === 'failed' ? 'FAILED' : 'PENDING')),
        paymentAmount: reg.payment?.amount || 1500,
        passId: pass?.passId || null,
        passStatus: pass?.status || (isPaid ? 'PENDING' : 'NOT_ISSUED'),
        whatsappOptIn: optIn,
        attendance: isPresent ? 'PRESENT' : 'ABSENT',
        messages: {
          registration: mReg ? {
            status: mReg.status,
            sentAt: mReg.sentAt,
            deliveredAt: mReg.deliveredAt,
            readAt: mReg.readAt,
            failedAt: mReg.failedAt,
            reasonIfMissing: null
          } : { status: 'NOT_SENT', reasonIfMissing: getReason('registration') },

          paymentReminder: {
            count: mPayReminders.length,
            status: mPayReminders.length > 0
              ? mPayReminders[mPayReminders.length - 1].status
              : (isPaid ? 'NOT_REQUIRED' : (isPaymentNotOpen ? 'NOT_OPEN_YET' : 'SCHEDULED')),
            nextScheduledAt: reg.paymentReminder?.nextReminderAt || null,
            reasonIfMissing: mPayReminders.length === 0 ? getReason('payment_reminder') : null
          },

          paymentConfirmed: mPayConf ? {
            status: mPayConf.status,
            sentAt: mPayConf.sentAt,
            deliveredAt: mPayConf.deliveredAt,
            readAt: mPayConf.readAt,
            failedAt: mPayConf.failedAt,
            reasonIfMissing: null
          } : { status: isPaid ? 'PENDING' : 'NOT_SENT', reasonIfMissing: getReason('payment_confirmation') },

          invitation48h: mInv ? {
            status: mInv.status,
            scheduledFor: mInv.scheduledFor,
            sentAt: mInv.sentAt,
            deliveredAt: mInv.deliveredAt,
            readAt: mInv.readAt,
            failedAt: mInv.failedAt,
            reasonIfMissing: null
          } : { status: isPaid ? 'SCHEDULED' : 'WAITING_PAYMENT', reasonIfMissing: getReason('invitation') },

          reminder24h: mRem ? {
            status: mRem.status,
            scheduledFor: mRem.scheduledFor,
            sentAt: mRem.sentAt,
            deliveredAt: mRem.deliveredAt,
            readAt: mRem.readAt,
            failedAt: mRem.failedAt,
            reasonIfMissing: null
          } : { status: isPaid ? 'SCHEDULED' : 'WAITING_PAYMENT', reasonIfMissing: getReason('reminder') },

          feedback: mFb ? {
            status: mFb.status,
            scheduledFor: mFb.scheduledFor,
            sentAt: mFb.sentAt,
            deliveredAt: mFb.deliveredAt,
            readAt: mFb.readAt,
            failedAt: mFb.failedAt,
            reasonIfMissing: null
          } : { status: isPresent ? 'SCHEDULED' : 'WAITING_EVENT', reasonIfMissing: getReason('feedback') },

          gallery: mGal ? {
            status: mGal.status,
            scheduledFor: mGal.scheduledFor,
            sentAt: mGal.sentAt,
            deliveredAt: mGal.deliveredAt,
            readAt: mGal.readAt,
            failedAt: mGal.failedAt,
            reasonIfMissing: null
          } : { status: 'NOT_READY', reasonIfMissing: getReason('gallery') }
        },
        totals,
        lastCommunication,
        nextCommunication,
        health
      };
    });

    // Client-side filtering if complex message status filters applied
    let filteredRows = rows;
    if (healthFilter !== 'ALL') {
      filteredRows = filteredRows.filter(r => r.health === healthFilter);
    }
    if (messageStatusFilter === 'READ') {
      filteredRows = filteredRows.filter(r => r.totals.read > 0);
    } else if (messageStatusFilter === 'DELIVERED_NOT_READ') {
      filteredRows = filteredRows.filter(r => r.totals.delivered > r.totals.read);
    } else if (messageStatusFilter === 'SENT_NOT_DELIVERED') {
      filteredRows = filteredRows.filter(r => r.totals.sent > r.totals.delivered);
    } else if (messageStatusFilter === 'FAILED' || messageStatusFilter === 'NOT_DELIVERED') {
      filteredRows = filteredRows.filter(r => r.totals.failed > 0);
    }

    res.json({
      success: true,
      pagination: {
        total: totalRegistrations,
        page,
        limit,
        totalPages
      },
      rows: filteredRows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching registration communication table.', details: err.message });
  }
};

/**
 * Preview audience counts before launching manual broadcast
 */
export const previewBroadcastAudience = async (req, res) => {
  const { eventId, audience } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId is required.' });

  try {
    const match = { programId: eventId, isDeleted: false };
    if (audience === 'ALL_CONFIRMED') match.status = 'approved';
    if (audience === 'PAYMENT_PENDING') match.status = { $in: ['pending', 'inquiry'] };
    if (audience === 'ATTENDED') {
      match.status = 'approved';
      match.$or = [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }];
    }

    const totalRegistrations = await Registration.countDocuments(match);
    const eligibleCount = await Registration.countDocuments({ ...match, whatsappOptIn: true, phoneNumber: { $exists: true, $ne: '' } });
    const optedOutCount = await Registration.countDocuments({ ...match, whatsappOptIn: false });
    const missingPhoneCount = await Registration.countDocuments({ ...match, $or: [{ phoneNumber: '' }, { phoneNumber: null }] });

    res.json({
      success: true,
      audience: audience || 'ALL_CONFIRMED',
      totalRegistrations,
      eligibleCount,
      optedOutCount,
      missingPhoneCount,
      finalRecipientCount: eligibleCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Error calculating broadcast preview.', details: err.message });
  }
};

/**
 * Queue manual broadcast communication batch
 */
export const createEventBroadcast = async (req, res) => {
  const { eventId, audience, templateKey, customMessage } = req.body;
  if (!eventId || !templateKey) {
    return res.status(400).json({ error: 'eventId and templateKey are required.' });
  }

  try {
    const match = { programId: eventId, isDeleted: false, whatsappOptIn: true, phoneNumber: { $exists: true, $ne: '' } };
    if (audience === 'ALL_CONFIRMED') match.status = 'approved';
    if (audience === 'PAYMENT_PENDING') match.status = { $in: ['pending', 'inquiry'] };
    if (audience === 'ATTENDED') {
      match.status = 'approved';
      match.$or = [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }];
    }

    const recipients = await Registration.find(match).lean();
    const event = await Event.findOne({ $or: [{ id: eventId }, { slug: eventId }] }).lean();

    let queuedCount = 0;
    const now = new Date();

    for (const reg of recipients) {
      const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim() || 'Respected Couple';
      const cleanPhone = reg.phoneNumber ? reg.phoneNumber.replace(/\D/g, '') : '';
      if (!cleanPhone) continue;

      const idempotencyKey = `BROADCAST:${eventId}:${templateKey}:${reg.inquiryId}:${Date.now()}`;

      await WhatsappMessage.create({
        messageId: `WA-BCAST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        eventId,
        registrationId: reg._id,
        inquiryId: reg.inquiryId,
        recipientPhone: cleanPhone,
        recipientMasked: cleanPhone.replace(/(\d{4})\d{4}(\d{2})/, '$1****$2'),
        templateName: templateKey,
        templateLanguage: 'en_US',
        templateCategory: 'UTILITY',
        messageType: 'custom',
        trigger: 'manual_broadcast',
        executionSource: 'NORMAL',
        providerMode: 'META',
        idempotencyKey,
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
        scheduledFor: now,
        templateParameters: {
          customerName,
          eventName: event?.name || reg.programName || 'Ek Duje Ke Liye Seminar',
          eventDate: event?.date || reg.programDate || '',
          eventTime: event?.time || reg.programTime || '8:30 PM',
          venue: event?.venue || 'Sardar Smruti Bhavan, Surat',
          registrationId: reg.inquiryId,
          inquiryId: reg.inquiryId,
          customMessage: customMessage || ''
        }
      });

      queuedCount++;
    }

    res.json({
      success: true,
      message: `Broadcast queued successfully for ${queuedCount} recipients.`,
      queuedCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Error queueing broadcast.', details: err.message });
  }
};

/**
 * Trigger gallery ready messages for attended participants
 */
export const triggerGalleryReady = async (req, res) => {
  const { eventId } = req.params;
  const { galleryUrl } = req.body;
  if (!eventId) return res.status(400).json({ error: 'Event ID is required.' });

  try {
    const attendees = await Registration.find({
      programId: eventId,
      status: 'approved',
      $or: [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }],
      whatsappOptIn: true,
      isDeleted: false
    }).lean();

    let queuedCount = 0;
    const now = new Date();

    for (const reg of attendees) {
      const cleanPhone = reg.phoneNumber ? reg.phoneNumber.replace(/\D/g, '') : '';
      if (!cleanPhone) continue;

      const idempotencyKey = `GALLERY:${eventId}:${reg.inquiryId}`;

      await WhatsappMessage.findOneAndUpdate(
        { idempotencyKey },
        {
          $setOnInsert: {
            messageId: `WA-GAL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            eventId,
            registrationId: reg._id,
            inquiryId: reg.inquiryId,
            recipientPhone: cleanPhone,
            recipientMasked: cleanPhone.replace(/(\d{4})\d{4}(\d{2})/, '$1****$2'),
            templateName: 'edkl_event_update_v1',
            templateLanguage: 'en_US',
            templateCategory: 'UTILITY',
            messageType: 'gallery_ready',
            trigger: 'gallery_ready',
            executionSource: 'NORMAL',
            providerMode: 'META',
            idempotencyKey,
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
            scheduledFor: now,
            templateParameters: {
              customerName: `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim(),
              eventName: reg.programName || 'Ek Duje Ke Liye Seminar',
              registrationId: reg.inquiryId,
              inquiryId: reg.inquiryId,
              galleryUrl: galleryUrl || 'https://www.ekdujekeliye.in/gallery'
            }
          }
        },
        { upsert: true }
      );
      queuedCount++;
    }

    res.json({
      success: true,
      message: `Gallery link queued for ${queuedCount} attended participants.`,
      queuedCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Error queueing gallery notifications.', details: err.message });
  }
};

/**
 * Trigger scheduler worker execution manually or via simulated clock
 */
export const runSchedulerWorker = async (req, res) => {
  try {
    const { simulatedNow } = req.body || {};
    const summary = await communicationSchedulerService.processScheduledJobs({ simulatedNow });
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ error: 'Error running scheduler worker.', details: err.message });
  }
};

/**
 * Manual Admin Resend with cooldown and audit logging
 */
export const resendMessage = async (req, res) => {
  const { inquiryId, templateKey } = req.body;
  if (!inquiryId || !templateKey) {
    return res.status(400).json({ error: 'inquiryId and templateKey are required.' });
  }

  try {
    const reg = await Registration.findOne({ inquiryId: { $regex: new RegExp(`^${inquiryId.trim()}$`, 'i') } });
    if (!reg) return res.status(404).json({ error: 'Registration record not found.' });

    // Cooldown check: 2 minutes cooldown between manual resends for same template & inquiry
    const recentSent = await WhatsappMessage.findOne({
      inquiryId: reg.inquiryId,
      templateName: templateKey,
      sentAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
    });

    if (recentSent) {
      return res.status(429).json({
        error: 'COOLDOWN_ACTIVE',
        message: 'A message of this type was sent within the last 2 minutes. Please wait before resending.'
      });
    }

    const event = await Event.findOne({ $or: [{ id: reg.programId }, { slug: reg.programId }] });
    const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Respected Couple';

    const sendRes = await sendUtilityTemplate({
      recipientPhone: reg.phoneNumber,
      templateKey,
      languageCode: 'en_US',
      variables: {
        customerName,
        eventName: event?.name || reg.programName || 'Ek Duje Ke Liye Seminar',
        eventDate: event?.date || reg.programDate || '',
        eventTime: event?.time || reg.programTime || '8:30 PM',
        venue: event?.venue || 'Sardar Smruti Bhavan, Surat',
        registrationId: reg.inquiryId,
        inquiryId: reg.inquiryId
      },
      idempotencyKey: `MANUAL_RESEND:${templateKey}:${reg.inquiryId}:${Date.now()}`,
      registrationId: reg._id,
      eventId: reg.programId,
      inquiryId: reg.inquiryId,
      trigger: 'admin_manual_resend',
      executionSource: 'MANUAL_ADMIN'
    });

    res.json({
      success: sendRes.success,
      status: sendRes.status,
      providerMessageId: sendRes.providerMessageId,
      message: sendRes.success ? 'Message successfully resent.' : (sendRes.message || 'Could not resend message.')
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during message resend.', details: err.message });
  }
};
