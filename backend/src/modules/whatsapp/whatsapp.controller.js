import mongoose from 'mongoose';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { verifyWebhook, handleWebhookEvent, sendUtilityTemplate, sendFreeTextMessage, hashPhoneNumber, normalizePhoneNumber, maskPhoneNumber } from '../../integrations/whatsapp/whatsapp.service.js';
import { WhatsappTemplate } from '../../models/WhatsappTemplate.js';
import { CORE_TEMPLATES } from '../../integrations/whatsapp/templateRegistry.js';
import { Registration } from '../../models/Registration.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../../models/WhatsappMessage.js';
import { WhatsappConversation } from '../../models/WhatsappConversation.js';
import { Pass } from '../../models/Pass.js';
import { Event } from '../../models/Event.js';
import { communicationSchedulerService } from '../../services/communicationScheduler.service.js';
import { invitationCardService } from '../../services/invitationCard.service.js';
import { ensureFeedbackToken } from '../feedback/feedback.controller.js';

export const handleVerification = verifyWebhook;
export const handleEvents = handleWebhookEvent;

/**
 * Get all official Meta approved WhatsApp templates configured in system (filtering out deprecated and fallback-only)
 */
export const getMetaTemplates = async (req, res) => {
  try {
    const includeAll = req.query.includeAll === 'true';
    const list = Object.values(CORE_TEMPLATES)
      .filter((tpl) => includeAll || (!tpl.isDeprecated && !tpl.isFallbackOnly && tpl.section !== 'DEPRECATED' && tpl.section !== 'FALLBACK'))
      .map((tpl) => {
        const bodyComp = tpl.components?.find((c) => c.type === 'BODY');
        const buttonComp = tpl.components?.find((c) => c.type === 'BUTTONS');
        const buttons = buttonComp?.buttons || [];

        return {
          key: tpl.key,
          metaName: tpl.metaName,
          category: tpl.category || 'UTILITY',
          section: tpl.section || 'CORE',
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

    res.json({ success: true, metaTemplates: list, total: list.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching Meta templates.' });
  }
};

/**
 * Send a test or real Meta WhatsApp template message
 */
export const sendTestMessage = async (req, res) => {
  const { recipientPhone, templateKey, submissionId, customVariables } = req.body;

  const tplKey = templateKey || 'edkl_payment_confirmed_pass_v2';
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

    let headerImageUrl = customVariables?.headerImageUrl;
    if (!headerImageUrl && targetRegistration) {
      try {
        const program = await Event.findOne({
          $or: [{ id: targetRegistration.programId }, { slug: targetRegistration.programId }]
        });
        const cardRes = await invitationCardService.ensureInvitationCard(targetRegistration, program);
        if (cardRes && cardRes.cardUrl) {
          headerImageUrl = cardRes.cardUrl;
        }
      } catch (_) {}
      if (!headerImageUrl) {
        headerImageUrl = targetRegistration.couplePhoto || 'https://www.ekdujekeliye.in/sample_couple.png';
      }
    }

    const statusText = targetRegistration?.isVip
      ? 'VIP Pass Confirmed'
      : (targetRegistration ? 'Payment Confirmed' : (customVariables?.statusText || 'Registration Confirmed'));

    const galleryToken = customVariables?.galleryToken || targetRegistration?.inquiryId || inquiryId || 'TEST-01';
    const feedbackToken = customVariables?.feedbackToken || targetRegistration?.customerToken || targetRegistration?.inquiryId || inquiryId || 'demo-feedback';

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
        statusText,
        headerImageUrl,
        galleryToken,
        feedbackToken,
        ...(customVariables || {})
      },
      idempotencyKey: `MANUAL_${targetRegistration ? 'REAL' : 'TEST'}:${tplKey}:${cleanPhone}:${Date.now()}`,
      trigger: targetRegistration ? (targetRegistration.isVip ? 'vip_invitation_pass' : 'manual_admin_resend') : 'manual_admin_test',
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
const commDashboardCache = new Map();

/**
 * Get Event Communication Dashboard Overview & Aggregate Metrics (Zero N+1, < 50ms)
 */
export const getEventCommunicationDashboard = async (req, res) => {
  const { eventId } = req.params;
  if (!eventId) return res.status(400).json({ error: 'Event ID is required.' });

  try {
    const now = Date.now();
    const cacheKey = String(eventId || 'all');
    const cached = commDashboardCache.get(cacheKey);
    if (cached && now < cached.expiry) {
      return res.json(cached.data);
    }

    let event = null;
    let matchedIds = [];
    if (eventId && eventId !== 'all') {
      event = await Event.findOne(
        { $or: [{ id: eventId }, { slug: eventId }, { date: eventId }] },
        'id name slug date time venue city capacity status price isPaymentEnabled earlyRegistrationMode'
      ).lean();

      matchedIds.push(eventId);
      if (event) {
        if (event.id && !matchedIds.includes(event.id)) matchedIds.push(event.id);
        if (event.slug && !matchedIds.includes(event.slug)) matchedIds.push(event.slug);
      }
    }

    const eventRegMatch = {
      ...(matchedIds.length > 0 ? {
        $or: [
          { programId: { $in: matchedIds } },
          ...(event?.date ? [{ programDate: event.date }] : [])
        ]
      } : {}),
      isDeleted: { $ne: true }
    };

    const eventMsgMatch = {
      ...(matchedIds.length > 0 ? {
        $or: [
          { eventId: { $in: matchedIds } },
          ...(event?.date ? [{ eventDate: event.date }] : [])
        ]
      } : {})
    };

    // Parallel aggregate queries in single roundtrip (< 30ms)
    const [regAggList, breakdown, actionNeededIds] = await Promise.all([
      Registration.aggregate([
        { $match: eventRegMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            confirmed: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $in: ['$status', ['pending', 'inquiry']] }, 1, 0] } },
            optIn: { $sum: { $cond: [{ $eq: ['$whatsappOptIn', true] }, 1, 0] } },
            optOut: { $sum: { $cond: [{ $eq: ['$whatsappOptIn', false] }, 1, 0] } },
            attended: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'approved'] },
                      { $in: ['$attendance', ['PRESENT', 'present', true]] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      WhatsappMessage.aggregate([
        { $match: eventMsgMatch },
        {
          $group: {
            _id: { messageType: '$messageType', status: '$status' },
            count: { $sum: 1 }
          }
        }
      ]),
      Registration.find({
        ...eventRegMatch,
        status: { $ne: 'approved' }
      })
        .select('inquiryId')
        .lean()
        .then(async (unpaidRegs) => {
          if (!unpaidRegs || unpaidRegs.length === 0) return [];
          const unpaidIds = unpaidRegs.map(r => r.inquiryId);
          return WhatsappMessage.distinct('inquiryId', {
            inquiryId: { $in: unpaidIds },
            status: 'FAILED'
          });
        })
    ]);

    const regAgg = regAggList[0] || {
      total: 0,
      confirmed: 0,
      pending: 0,
      optIn: 0,
      optOut: 0,
      attended: 0
    };

    const totalRegistrations = regAgg.total;
    const confirmedRegistrations = regAgg.confirmed;
    const paymentPendingRegistrations = regAgg.pending;
    const whatsappOptIn = regAgg.optIn;
    const whatsappOptOut = regAgg.optOut;
    const attendedRegistrations = regAgg.attended;

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
    const actionNeededCount = (actionNeededIds || []).filter(Boolean).length;

    const result = {
      success: true,
      eventId: event?.id || eventId,
      eventName: event?.name || (eventId === 'all' ? 'All Seminar Slots' : 'Seminar Slot'),
      eventDate: event?.date || '',
      eventTime: event?.time || '',
      venue: event?.venue || '',
      city: event?.city || '',
      capacity: event?.capacity || 0,
      price: event?.price || 1500,
      summary: {
        totalRegistrations,
        confirmedRegistrations,
        paymentPendingRegistrations,
        whatsappOptIn,
        whatsappOptOut,
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
        isPaymentEnabled: event?.isPaymentEnabled !== false,
        earlyRegistrationMode: event?.earlyRegistrationMode === true
      }
    };

    commDashboardCache.set(cacheKey, { data: result, expiry: now + 5000 });
    res.json(result);
  } catch (err) {
    logger.error('Error generating event communication dashboard:', err);
    res.status(500).json({ error: 'Error generating communication dashboard.', details: err.message });
  }
};

/**
 * Get Per-Person Registration Communication Table (Server-side Pagination, Filters, Zero N+1, < 100ms)
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

    let eventMatchOr = [];
    let event = null;
    if (eventId && eventId !== 'all') {
      event = await Event.findOne(
        { $or: [{ id: eventId }, { slug: eventId }, { date: eventId }] },
        'id name slug date time venue city capacity status price isPaymentEnabled earlyRegistrationMode'
      ).lean();

      const matchedIds = [eventId];
      if (event) {
        if (event.id && !matchedIds.includes(event.id)) matchedIds.push(event.id);
        if (event.slug && !matchedIds.includes(event.slug)) matchedIds.push(event.slug);
      }

      eventMatchOr = [
        { programId: { $in: matchedIds } },
        ...(event?.date ? [{ programDate: event.date }] : [])
      ];
    }

    const andConditions = [
      ...(eventMatchOr.length > 0 ? [{ $or: eventMatchOr }] : []),
      { isDeleted: { $ne: true } }
    ];

    if (search) {
      const cleanSearch = search.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
      const phoneDigits = search.replace(/\D/g, '');
      const searchTerms = search.split(/\s*&\s*|\s+/).filter(Boolean);

      const searchOr = [
        { husbandName: { $regex: cleanSearch, $options: 'i' } },
        { wifeName: { $regex: cleanSearch, $options: 'i' } },
        { surname: { $regex: cleanSearch, $options: 'i' } },
        { inquiryId: { $regex: cleanSearch, $options: 'i' } },
        { phoneNumber: { $regex: cleanSearch, $options: 'i' } }
      ];

      if (phoneDigits.length >= 4) {
        searchOr.push({ phoneNumber: { $regex: phoneDigits, $options: 'i' } });
      }

      // If user typed multi-word names like "Ravi & Krupa" or "Ravi Devani"
      if (searchTerms.length >= 2) {
        searchOr.push({
          $and: searchTerms.map(term => ({
            $or: [
              { husbandName: { $regex: term.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'), $options: 'i' } },
              { wifeName: { $regex: term.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'), $options: 'i' } },
              { surname: { $regex: term.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'), $options: 'i' } },
              { inquiryId: { $regex: term.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'), $options: 'i' } }
            ]
          }))
        });
      }

      andConditions.push({ $or: searchOr });
    }

    if (paymentFilter === 'PAID') {
      andConditions.push({ status: 'approved' });
    } else if (paymentFilter === 'PENDING') {
      andConditions.push({ status: { $in: ['pending', 'inquiry'] } });
    } else if (paymentFilter === 'FAILED') {
      andConditions.push({ 'payment.status': 'failed' });
    }

    if (attendanceFilter === 'PRESENT') {
      andConditions.push({
        $or: [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }]
      });
    } else if (attendanceFilter === 'ABSENT') {
      andConditions.push({
        $or: [{ attendance: 'ABSENT' }, { attendance: 'absent' }, { attendance: false }, { attendance: 'unmarked' }]
      });
    }

    let matchQuery = { $and: andConditions };

    let [totalRegistrations, registrations] = await Promise.all([
      Registration.countDocuments(matchQuery),
      Registration.find(matchQuery)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('inquiryId customerToken husbandName wifeName surname phoneNumber whatsappOptIn whatsappMarketingOptIn whatsappOptOutAt status payment attendance isDeleted createdAt updatedAt')
        .lean()
    ]);

    // Fallback: If user searched specifically for a name/phone/ID and 0 results found for this event,
    // search across ALL events so the user finds the couple!
    if (search && totalRegistrations === 0 && eventMatchOr.length > 0) {
      const globalAnd = andConditions.filter(c => !c.$or || c.$or !== eventMatchOr);
      const globalMatch = { $and: globalAnd };
      const [gTotal, gRegs] = await Promise.all([
        Registration.countDocuments(globalMatch),
        Registration.find(globalMatch)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('inquiryId customerToken husbandName wifeName surname phoneNumber whatsappOptIn whatsappMarketingOptIn whatsappOptOutAt status payment attendance isDeleted createdAt updatedAt')
          .lean()
      ]);
      if (gTotal > 0) {
        totalRegistrations = gTotal;
        registrations = gRegs;
      }
    }

    const totalPages = Math.ceil(totalRegistrations / limit) || 1;

    const regIds = registrations.map(r => r._id);
    const inquiryIds = registrations.map(r => r.inquiryId);

    // Fetch passes and messages in parallel batch (< 40ms)
    const [passes, messages] = await Promise.all([
      Pass.find({ registrationId: { $in: regIds } })
        .select('passId status version qrVersion registrationId inquiryId')
        .lean(),
      WhatsappMessage.find({
        $or: [
          { registrationId: { $in: regIds } },
          { inquiryId: { $in: inquiryIds } }
        ]
      })
        .select('messageId registrationId inquiryId messageType status trigger templateName sentAt deliveredAt readAt failedAt lastErrorMessage scheduledFor createdAt')
        .sort({ createdAt: 1 })
        .lean()
    ]);

    const passMap = new Map();
    passes.forEach(p => passMap.set(String(p.registrationId), p));

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

      // Extract specific lifecycle messages with robust matching across templateName, trigger, and messageType
      const mReg = regMsgs.find(m =>
        m.messageType === 'registration_received' ||
        m.templateName?.includes('registration_received') ||
        m.trigger === 'registration_received'
      );
      const mPayReminders = regMsgs.filter(m =>
        m.messageType === 'payment_pending' ||
        m.templateName?.includes('payment_pending') ||
        m.templateName?.includes('polite_payment') ||
        m.trigger === 'payment_pending' ||
        m.trigger === 'registration_created'
      );
      const mPayConf = regMsgs.find(m =>
        (m.messageType === 'payment_confirmation' ||
         m.templateName?.includes('payment_confirmed') ||
         m.trigger === 'payment_verified' ||
         m.trigger === 'manual_approval') &&
        !(m.templateName && (m.templateName.includes('payment_pending') || m.templateName.includes('polite_payment')))
      );
      const mInv = regMsgs.find(m =>
        m.messageType === 'invitation' ||
        m.templateName?.includes('invitation') ||
        m.trigger === 'invitation_48h'
      );
      const mRem = regMsgs.find(m =>
        m.messageType === 'reminder' ||
        m.templateName?.includes('reminder') ||
        m.trigger === 'reminder_24h'
      );
      const mFb = regMsgs.find(m =>
        m.messageType === 'feedback_request' ||
        m.templateName?.includes('feedback') ||
        m.trigger === 'feedback_post_event'
      );
      const mGal = regMsgs.find(m =>
        m.messageType === 'gallery_ready' ||
        m.templateName?.includes('gallery') ||
        m.trigger === 'gallery_broadcast'
      );

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

      // Deterministic Health Status: GOOD, WAITING, ACTION_NEEDED
      let health = 'GOOD';
      if (totals.failed > 0 || (!isPaid && reg.payment?.status === 'failed')) {
        health = 'ACTION_NEEDED';
      } else if (totals.pending > 0 || (!isPaid && reg.status === 'pending')) {
        health = 'WAITING';
      }

      // Reason if missing helper with standard lifecycle why-not-sent enums
      const eventStartAt = communicationSchedulerService.parseEventDateTime(event?.date, event?.time || '8:30 PM');
      const now = new Date();
      const remainingMinutes = eventStartAt ? (eventStartAt.getTime() - now.getTime()) / (60 * 1000) : 999999;

      const getReason = (type) => {
        if (!optIn) return 'WHATSAPP_OPT_OUT';
        if (!reg.phoneNumber) return 'PHONE_MISSING';
        if (event?.status === 'cancelled') return 'EVENT_CANCELLED';
        if (eventStartAt && now >= eventStartAt) {
          if (type === 'pass_reminder_48h' || type === 'invitation_24h' || type === 'payment_reminder') {
            return 'EVENT_STARTED';
          }
        }
        if (type === 'payment_reminder') {
          if (isPaid) return 'NOT_REQUIRED';
          if (event?.isPaymentEnabled === false || event?.earlyRegistrationMode === true) return 'PAYMENT_NOT_OPEN';
          return 'PAYMENT_PENDING';
        }
        if (type === 'payment_confirmed') {
          if (!isPaid) return 'PAYMENT_NOT_COMPLETE';
          if (!pass || pass.status !== 'ACTIVE') return 'PASS_NOT_ACTIVE';
        }
        if (type === 'pass_reminder_48h') {
          if (!isPaid) return 'PAYMENT_NOT_COMPLETE';
          if (remainingMinutes <= 48 * 60) return '48H_WINDOW_EXPIRED';
        }
        if (type === 'invitation_24h') {
          if (!isPaid) return 'PAYMENT_NOT_COMPLETE';
          if (event?.personalizedInvitationEnabled === false) return 'DISABLED_FOR_EVENT';
          if (remainingMinutes < 120) return 'TOO_CLOSE_TO_EVENT';
          if (remainingMinutes < 24 * 60) return 'LATE_INVITATION_SCHEDULED';
        }
        if (type === 'post_event') {
          if (!isPaid) return 'PAYMENT_NOT_COMPLETE';
          const midnight = calculateEventMidnightIST(event?.date);
          if (midnight && now < midnight) return 'EVENT_UPCOMING';
          if (!isPresent) return 'NO_ATTENDANCE';
          return 'NOT_YET_DUE';
        }
        return 'NOT_YET_DUE';
      };

      const isPaymentNotOpen = Boolean(!isPaid && (event?.isPaymentEnabled === false || event?.earlyRegistrationMode === true));

      const mPostCombined = regMsgs.find(m =>
        m.messageType === 'post_event' ||
        m.templateName === 'edkl_post_event_memories_feedback_v1' ||
        m.trigger === 'post_event_memories_feedback' ||
        m.messageType === 'gallery_ready' ||
        m.messageType === 'feedback_request'
      );

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
          } : { status: isPaid ? 'PENDING' : 'NOT_SENT', reasonIfMissing: getReason('payment_confirmed') },

          passReminder48h: mRem ? {
            status: mRem.status,
            scheduledFor: mRem.scheduledFor,
            sentAt: mRem.sentAt,
            deliveredAt: mRem.deliveredAt,
            readAt: mRem.readAt,
            failedAt: mRem.failedAt,
            reasonIfMissing: null
          } : { status: isPaid && remainingMinutes > 48 * 60 ? 'SCHEDULED' : 'SKIPPED', reasonIfMissing: getReason('pass_reminder_48h') },

          invitation24h: mInv ? {
            status: mInv.status,
            scheduledFor: mInv.scheduledFor,
            sentAt: mInv.sentAt,
            deliveredAt: mInv.deliveredAt,
            readAt: mInv.readAt,
            failedAt: mInv.failedAt,
            reasonIfMissing: null
          } : { status: isPaid && remainingMinutes >= 120 ? 'SCHEDULED' : 'SKIPPED', reasonIfMissing: getReason('invitation_24h') },

          postEvent: mPostCombined ? {
            status: mPostCombined.status,
            scheduledFor: mPostCombined.scheduledFor,
            sentAt: mPostCombined.sentAt,
            deliveredAt: mPostCombined.deliveredAt,
            readAt: mPostCombined.readAt,
            failedAt: mPostCombined.failedAt,
            reasonIfMissing: null
          } : {
            status: isPaid ? (now < calculateEventMidnightIST(event?.date) ? 'SCHEDULED' : (isPresent ? 'WAITING' : 'NOT_ELIGIBLE')) : 'NOT_ELIGIBLE',
            reasonIfMissing: getReason('post_event')
          },

          // Backwards compatible aliases
          registration: mReg ? { status: mReg.status, sentAt: mReg.sentAt, deliveredAt: mReg.deliveredAt, readAt: mReg.readAt, failedAt: mReg.failedAt, reasonIfMissing: null } : { status: 'NOT_REQUIRED', reasonIfMissing: 'NOT_REQUIRED' },
          invitation48h: mInv ? { status: mInv.status, scheduledFor: mInv.scheduledFor, sentAt: mInv.sentAt, deliveredAt: mInv.deliveredAt, readAt: mInv.readAt, failedAt: mInv.failedAt, reasonIfMissing: null } : { status: isPaid && remainingMinutes >= 120 ? 'SCHEDULED' : 'SKIPPED', reasonIfMissing: getReason('invitation_24h') },
          reminder24h: mRem ? { status: mRem.status, scheduledFor: mRem.scheduledFor, sentAt: mRem.sentAt, deliveredAt: mRem.deliveredAt, readAt: mRem.readAt, failedAt: mRem.failedAt, reasonIfMissing: null } : { status: isPaid && remainingMinutes > 48 * 60 ? 'SCHEDULED' : 'SKIPPED', reasonIfMissing: getReason('pass_reminder_48h') },
          feedback: mPostCombined ? { status: mPostCombined.status } : { status: isPaid ? (now < calculateEventMidnightIST(event?.date) ? 'SCHEDULED' : (isPresent ? 'WAITING' : 'NOT_ELIGIBLE')) : 'NOT_ELIGIBLE', reasonIfMissing: getReason('post_event') },
          gallery: mPostCombined ? { status: mPostCombined.status } : { status: isPaid ? (now < calculateEventMidnightIST(event?.date) ? 'SCHEDULED' : (isPresent ? 'WAITING' : 'NOT_ELIGIBLE')) : 'NOT_ELIGIBLE', reasonIfMissing: getReason('post_event') }
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
    console.error('[Registrations Communication Endpoint Error]:', err);
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
    if (galleryUrl && typeof galleryUrl === 'string' && galleryUrl.trim()) {
      await Event.updateOne(
        { $or: [{ id: eventId }, { slug: eventId }] },
        { $set: { photoLink: galleryUrl.trim() } }
      ).catch(() => {});
    }

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
 * Calculate Local Midnight (00:00 Asia/Kolkata) on the calendar day following the event date
 */
export function calculateEventMidnightIST(eventDateStr) {
  if (!eventDateStr || eventDateStr.toUpperCase() === 'TBD') return null;
  const parts = eventDateStr.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  // Local 00:00:00 IST on (day + 1) in UTC is previous day 18:30:00 UTC
  const midnightUtcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(midnightUtcMs);
}

/**
 * Get Post-Event Communication Readiness Status and Attendee Counts
 */
export const getPostEventStatus = async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findOne({ $or: [{ id: eventId }, { slug: eventId }] }).lean();
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const midnightAt = calculateEventMidnightIST(event.date);
    const now = new Date();
    const isPastMidnight = midnightAt ? now >= midnightAt : false;

    // Count PRESENT attendees
    const matchEvent = {
      programId: { $in: [event.id, event.slug, event.date].filter(Boolean) },
      status: 'approved',
      $or: [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }],
      isDeleted: false
    };

    const presentCount = await Registration.countDocuments(matchEvent);
    const eligibleWhatsappCount = await Registration.countDocuments({ ...matchEvent, whatsappOptIn: true });

    const alreadySentCount = await WhatsappMessage.countDocuments({
      eventId: { $in: [event.id, event.slug] },
      $or: [
        { messageType: 'post_event' },
        { messageType: 'gallery_ready' },
        { templateName: 'edkl_post_event_memories_feedback_v1' }
      ],
      status: { $in: ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ'] }
    });

    let lifecycleStatus = 'NOT_READY';
    if (alreadySentCount > 0 && alreadySentCount >= eligibleWhatsappCount && eligibleWhatsappCount > 0) {
      lifecycleStatus = 'SENT';
    } else if (isPastMidnight) {
      lifecycleStatus = 'READY_TO_SEND';
    }

    res.json({
      success: true,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      midnightAt,
      isPastMidnight,
      lifecycleStatus,
      presentCount,
      eligibleWhatsappCount,
      alreadySentCount,
      defaultGalleryUrl: event.photoLink || 'https://www.ekdujekeliye.in/gallery',
      feedbackEnabled: event.feedbackEnabled !== false
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post-event status.', details: err.message });
  }
};

/**
 * Trigger Combined Post-Event Communication (Thank you + Gallery + Feedback) to PRESENT attendees only
 */
export const triggerPostEventSend = async (req, res) => {
  const { eventId } = req.params;
  const { galleryUrl, forceSend } = req.body || {};
  if (!eventId) return res.status(400).json({ error: 'Event ID is required.' });

  try {
    const event = await Event.findOne({ $or: [{ id: eventId }, { slug: eventId }] }).lean();
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    // Persist photoLink to event for future reference
    if (galleryUrl && typeof galleryUrl === 'string' && galleryUrl.trim()) {
      await Event.updateOne(
        { $or: [{ id: eventId }, { slug: eventId }] },
        { $set: { photoLink: galleryUrl.trim() } }
      ).catch(() => {});
    }

    const midnightAt = calculateEventMidnightIST(event.date);
    const now = new Date();

    if (midnightAt && now < midnightAt && !forceSend) {
      return res.status(400).json({
        error: 'Post-event communications become ready at midnight following the event date.',
        midnightAt,
        currentTime: now
      });
    }

    // Strictly PRESENT attendees only
    const attendees = await Registration.find({
      programId: { $in: [event.id, event.slug, event.date].filter(Boolean) },
      status: 'approved',
      $or: [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }],
      whatsappOptIn: true,
      isDeleted: false
    }).lean();

    let queuedCount = 0;
    let alreadySentCount = 0;

    for (const reg of attendees) {
      const cleanPhone = reg.phoneNumber ? normalizePhoneNumber(reg.phoneNumber) : '';
      if (!cleanPhone) continue;

      const idempotencyKey = `POST_EVENT:${event.id || event.slug}:${reg._id}:v1`;

      const existing = await WhatsappMessage.findOne({ idempotencyKey }).lean();
      if (existing) {
        alreadySentCount++;
        continue;
      }

      const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Valued Couple';
      const fb = await ensureFeedbackToken(reg.inquiryId, event.id || event.slug, customerName);

      await WhatsappMessage.create({
        messageId: `WA-POST-${crypto.randomBytes(8).toString('hex')}`,
        eventId: event.id || event.slug,
        registrationId: reg._id,
        inquiryId: reg.inquiryId,
        recipientPhone: cleanPhone,
        recipientMasked: maskPhoneNumber(cleanPhone),
        templateName: 'edkl_post_event_memories_feedback_v1',
        templateLanguage: 'en_US',
        templateCategory: 'UTILITY',
        messageType: 'post_event',
        trigger: 'post_event_memories_feedback',
        executionSource: 'NORMAL',
        providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
        idempotencyKey,
        status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
        scheduledFor: now,
        templateParameters: {
          customerName,
          eventName: event.name || 'Ek Duje Ke Liye Seminar',
          registrationId: reg.inquiryId,
          galleryToken: reg.inquiryId,
          feedbackToken: fb?.token || reg.inquiryId
        }
      });
      queuedCount++;
    }

    res.json({
      success: true,
      message: `Post-event memories & feedback queued for ${queuedCount} attendees. (${alreadySentCount} already sent/idempotent).`,
      queuedCount,
      alreadySentCount,
      totalAttendees: attendees.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Error queueing post-event communications.', details: err.message });
  }
};

/**
 * Preview Specific-Number Bulk Audience with 24h Meta Customer Service Window Detection
 */
export const previewSpecificBroadcast = async (req, res) => {
  const { eventId, rawNumbers, messageMode = 'TEMPLATE', templateKey } = req.body || {};
  if (!eventId || !rawNumbers) {
    return res.status(400).json({ error: 'eventId and rawNumbers are required.' });
  }

  try {
    const rawList = String(rawNumbers)
      .split(/[\n,;\t]+/)
      .map(s => s.trim().replace(/\D/g, ''))
      .filter(s => s.length >= 10);

    const uniqueNumbers = [...new Set(rawList.map(num => normalizePhoneNumber(num)))];

    // Find registrations matching this event
    const event = await Event.findOne({ $or: [{ id: eventId }, { slug: eventId }] }).lean();
    const eventIds = [eventId, event?.id, event?.slug, event?.date].filter(Boolean);

    const matchedRegistrations = await Registration.find({
      programId: { $in: eventIds },
      isDeleted: false
    }).lean();

    const phoneToRegMap = new Map();
    for (const reg of matchedRegistrations) {
      if (reg.phoneNumber) {
        const norm = normalizePhoneNumber(reg.phoneNumber);
        phoneToRegMap.set(norm, reg);
      }
    }

    // Check 24-hour service window per recipient
    const now = new Date();
    const recipients = [];
    let windowOpenCount = 0;
    let windowClosedCount = 0;
    let optedOutCount = 0;
    let matchedCount = 0;

    for (const phone of uniqueNumbers) {
      const reg = phoneToRegMap.get(phone);
      if (!reg) continue;
      matchedCount++;

      if (reg.whatsappOptIn === false) {
        optedOutCount++;
        continue;
      }

      // Check conversation window
      const conv = await WhatsappConversation.findOne({ customerPhone: phone }).lean();
      const isWindowOpen = Boolean(
        conv && (conv.isCustomerServiceWindowOpen || (conv.customerServiceWindowExpiresAt && new Date(conv.customerServiceWindowExpiresAt) > now))
      );

      if (isWindowOpen) windowOpenCount++;
      else windowClosedCount++;

      recipients.push({
        phone,
        maskedPhone: maskPhoneNumber(phone),
        inquiryId: reg.inquiryId,
        customerName: `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim(),
        paymentStatus: reg.status === 'approved' || reg.payment?.status === 'captured' ? 'PAID' : 'PENDING',
        isWindowOpen,
        windowExpiresAt: conv?.customerServiceWindowExpiresAt || null
      });
    }

    const eligibleCount = messageMode === 'FREE_TEXT' ? windowOpenCount : recipients.length;

    res.json({
      success: true,
      inputCount: uniqueNumbers.length,
      matchedCount,
      unmatchedCount: uniqueNumbers.length - matchedCount,
      windowOpenCount,
      windowClosedCount,
      optedOutCount,
      eligibleCount,
      messageMode,
      recipients
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate broadcast preview.', details: err.message });
  }
};

/**
 * Dispatch Specific Bulk Messages with Strict 24h Window Protections
 */
export const sendSpecificBroadcast = async (req, res) => {
  const { eventId, rawNumbers, messageMode = 'TEMPLATE', templateKey, customMessage } = req.body || {};
  if (!eventId || !rawNumbers) {
    return res.status(400).json({ error: 'eventId and rawNumbers are required.' });
  }
  if (messageMode === 'TEMPLATE' && !templateKey) {
    return res.status(400).json({ error: 'templateKey is required for TEMPLATE mode.' });
  }
  if (messageMode === 'FREE_TEXT' && !customMessage) {
    return res.status(400).json({ error: 'customMessage is required for FREE_TEXT mode.' });
  }

  try {
    const rawList = String(rawNumbers)
      .split(/[\n,;\t]+/)
      .map(s => s.trim().replace(/\D/g, ''))
      .filter(s => s.length >= 10);

    const uniqueNumbers = [...new Set(rawList.map(num => normalizePhoneNumber(num)))];
    const event = await Event.findOne({ $or: [{ id: eventId }, { slug: eventId }] }).lean();
    const eventIds = [eventId, event?.id, event?.slug, event?.date].filter(Boolean);

    const matchedRegistrations = await Registration.find({
      programId: { $in: eventIds },
      isDeleted: false
    }).lean();

    const phoneToRegMap = new Map();
    for (const reg of matchedRegistrations) {
      if (reg.phoneNumber) {
        phoneToRegMap.set(normalizePhoneNumber(reg.phoneNumber), reg);
      }
    }

    const now = new Date();
    let queuedCount = 0;
    let skippedClosedWindowCount = 0;
    let skippedOptOutCount = 0;

    for (const phone of uniqueNumbers) {
      const reg = phoneToRegMap.get(phone);
      if (!reg) continue;

      if (reg.whatsappOptIn === false) {
        skippedOptOutCount++;
        continue;
      }

      const conv = await WhatsappConversation.findOne({ customerPhone: phone }).lean();
      const isWindowOpen = Boolean(
        conv && (conv.isCustomerServiceWindowOpen || (conv.customerServiceWindowExpiresAt && new Date(conv.customerServiceWindowExpiresAt) > now))
      );

      // In FREE_TEXT mode, strictly exclude closed-window recipients
      if (messageMode === 'FREE_TEXT') {
        if (!isWindowOpen) {
          skippedClosedWindowCount++;
          continue;
        }

        const idempotencyKey = `BCAST_FREE:${eventId}:${reg._id}:${Date.now()}`;
        await WhatsappMessage.create({
          messageId: `WA-BCAST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          eventId: event.id || event.slug,
          registrationId: reg._id,
          inquiryId: reg.inquiryId,
          recipientPhone: phone,
          recipientMasked: maskPhoneNumber(phone),
          templateName: 'free_text',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'custom',
          trigger: 'manual_broadcast_freetext',
          executionSource: 'NORMAL',
          providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
          idempotencyKey,
          content: customMessage,
          status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
          scheduledFor: now
        });
        queuedCount++;
      } else {
        // TEMPLATE mode
        const idempotencyKey = `BCAST_TPL:${eventId}:${templateKey}:${reg._id}:${Date.now()}`;
        const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Valued Couple';

        await WhatsappMessage.create({
          messageId: `WA-BCAST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          eventId: event.id || event.slug,
          registrationId: reg._id,
          inquiryId: reg.inquiryId,
          recipientPhone: phone,
          recipientMasked: maskPhoneNumber(phone),
          templateName: templateKey,
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'custom',
          trigger: 'manual_broadcast_template',
          executionSource: 'NORMAL',
          providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
          idempotencyKey,
          status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
          scheduledFor: now,
          templateParameters: {
            customerName,
            eventName: event?.name || 'Ek Duje Ke Liye Seminar',
            eventDate: event?.date || '',
            eventTime: event?.time || '8:30 PM',
            venue: event?.venue || 'Sardar Smruti Bhavan, Surat',
            registrationId: reg.inquiryId,
            inquiryId: reg.inquiryId,
            galleryToken: reg.inquiryId,
            feedbackToken: reg.customerToken || reg.inquiryId
          }
        });
        queuedCount++;
      }
    }

    res.json({
      success: true,
      message: `Bulk message queued for ${queuedCount} recipients.`,
      queuedCount,
      skippedClosedWindowCount,
      skippedOptOutCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Error sending specific bulk broadcast.', details: err.message });
  }
};

/**
 * Trigger scheduler worker execution manually or via simulated clock
 */
export const runSchedulerWorker = async (req, res) => {
  try {
    const { simulatedNow, eventId } = req.body || {};
    const summary = await communicationSchedulerService.processScheduledJobs({ simulatedNow, eventId });
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

/**
 * ============================================================================
 * TWO-WAY WHATSAPP HUMAN SUPPORT INBOX CONTROLLERS
 * ============================================================================
 */

/**
 * List WhatsApp conversations with pagination, search, and smart status filters
 */
export const getConversations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const search = (req.query.search || '').trim();
    const filter = req.query.filter || 'all';
    const eventId = req.query.eventId || '';

    const query = {};

    if (eventId && eventId !== 'all') {
      query.eventId = eventId;
    }

    const now = new Date();

    if (filter === 'unread') {
      query.unreadCount = { $gt: 0 };
    } else if (filter === 'open') {
      query.status = 'OPEN';
    } else if (filter === 'closed') {
      query.status = 'CLOSED';
    } else if (filter === 'unassigned') {
      query.assignedAdminId = null;
    } else if (filter === 'assigned_to_me') {
      const adminId = req.user?.id || req.user?.username || 'admin';
      query.assignedAdminId = adminId;
    } else if (filter === 'window_open') {
      query.customerServiceWindowExpiresAt = { $gt: now };
    } else if (filter === 'window_expired') {
      query.customerServiceWindowExpiresAt = { $lte: now };
    } else if (filter === 'window_expiring_soon') {
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      query.customerServiceWindowExpiresAt = { $gt: now, $lte: twoHoursLater };
    }

    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { inquiryId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      WhatsappConversation.find(query)
        .sort({ unreadCount: -1, lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'registrationId',
          select: 'inquiryId husbandName wifeName surname coupleName status payment attendance programId programName programDate isVip'
        })
        .lean(),
      WhatsappConversation.countDocuments(query)
    ]);

    const enriched = conversations.map(c => {
      const nowMs = Date.now();
      const expiry = c.customerServiceWindowExpiresAt ? new Date(c.customerServiceWindowExpiresAt).getTime() : 0;
      const isWindowOpen = expiry > nowMs;
      const windowRemainingSeconds = isWindowOpen ? Math.floor((expiry - nowMs) / 1000) : 0;

      const reg = c.registrationId;
      const paymentStatus = reg ? (reg.payment?.status === 'captured' || reg.status === 'approved' ? 'PAID' : 'PENDING') : 'UNKNOWN';

      return {
        _id: c._id,
        phone: c.phone,
        phoneMasked: c.phoneMasked || maskPhoneNumber(c.phone),
        customerName: c.customerName,
        inquiryId: c.inquiryId,
        eventId: c.eventId,
        status: c.status,
        unreadCount: c.unreadCount || 0,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview,
        lastMessageDirection: c.lastMessageDirection,
        lastMessageStatus: c.lastMessageStatus,
        lastInboundAt: c.lastInboundAt,
        lastOutboundAt: c.lastOutboundAt,
        customerServiceWindowExpiresAt: c.customerServiceWindowExpiresAt,
        isWindowOpen,
        windowRemainingSeconds,
        assignedAdminId: c.assignedAdminId,
        assignedAdminName: c.assignedAdminName,
        notesCount: c.notes?.length || 0,
        registration: reg ? {
          _id: reg._id,
          inquiryId: reg.inquiryId,
          coupleName: `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || reg.coupleName,
          programId: reg.programId,
          programName: reg.programName,
          programDate: reg.programDate,
          paymentStatus,
          paymentAmount: reg.payment?.amount || 1500,
          attendance: reg.attendance || 'unmarked'
        } : null
      };
    });

    res.json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      conversations: enriched
    });
  } catch (err) {
    console.error('[getConversations Error]:', err);
    res.status(500).json({ error: 'Server error fetching conversations.', details: err.message });
  }
};

/**
 * Get aggregated statistics for the WhatsApp Inbox overview
 */
export const getConversationStats = async (req, res) => {
  try {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const [openCount, unreadCount, unassignedCount, windowExpiringSoonCount, totalConversations] = await Promise.all([
      WhatsappConversation.countDocuments({ status: 'OPEN' }),
      WhatsappConversation.countDocuments({ unreadCount: { $gt: 0 } }),
      WhatsappConversation.countDocuments({ status: 'OPEN', assignedAdminId: null }),
      WhatsappConversation.countDocuments({
        status: 'OPEN',
        customerServiceWindowExpiresAt: { $gt: now, $lte: twoHoursLater }
      }),
      WhatsappConversation.countDocuments()
    ]);

    res.json({
      success: true,
      stats: {
        totalConversations,
        openCount,
        unreadCount,
        unassignedCount,
        windowExpiringSoonCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching conversation statistics.', details: err.message });
  }
};

/**
 * Get detailed conversation thread with unified timeline (inbound + outbound + lifecycle automation + pass + notes)
 */
export const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await WhatsappConversation.findById(conversationId)
      .populate('registrationId')
      .lean();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const clean10 = (conversation.phone || '').replace(/^91/, '');
    const phoneVariants = [
      conversation.phone,
      clean10,
      `91${clean10}`,
      `+91${clean10}`,
      `+${conversation.phone}`
    ].filter(Boolean);

    // Look up all unified messages for this conversation / phone
    const messages = await WhatsappMessage.find({
      $or: [
        { conversationId: conversation._id },
        { recipientPhone: { $in: phoneVariants } },
        { senderPhone: { $in: phoneVariants } },
        ...(conversation.registrationId ? [{ registrationId: conversation.registrationId._id || conversation.registrationId }] : []),
        ...(conversation.inquiryId ? [{ inquiryId: conversation.inquiryId }] : [])
      ]
    })
      .sort({ createdAt: 1 })
      .lean();

    // Auto-link any unlinked message
    const unlinkedIds = messages.filter(m => !m.conversationId).map(m => m._id);
    if (unlinkedIds.length > 0) {
      await WhatsappMessage.updateMany(
        { _id: { $in: unlinkedIds } },
        { $set: { conversationId: conversation._id } }
      ).catch(() => {});
    }

    // Look up Digital Pass if registered
    let pass = null;
    if (conversation.inquiryId || conversation.registrationId) {
      const inq = conversation.inquiryId || conversation.registrationId?.inquiryId;
      if (inq) {
        pass = await Pass.findOne({
          $or: [{ inquiryId: inq }, { registrationId: conversation.registrationId?._id || conversation.registrationId }]
        }).select('passId status version tier downloadedAt scannedAt isRevoked').lean();
      }
    }

    const nowMs = Date.now();
    const expiry = conversation.customerServiceWindowExpiresAt ? new Date(conversation.customerServiceWindowExpiresAt).getTime() : 0;
    const isWindowOpen = expiry > nowMs;
    const windowRemainingSeconds = isWindowOpen ? Math.floor((expiry - nowMs) / 1000) : 0;

    const reg = conversation.registrationId;
    const paymentStatus = reg ? (reg.payment?.status === 'captured' || reg.status === 'approved' ? 'PAID' : 'PENDING') : 'UNKNOWN';

    res.json({
      success: true,
      conversation: {
        ...conversation,
        isWindowOpen,
        windowRemainingSeconds,
        paymentStatus,
        pass
      },
      messages: messages.map(m => ({
        _id: m._id,
        messageId: m.messageId,
        direction: m.direction || (m.executionSource === 'INBOUND_WEBHOOK' ? 'INBOUND' : 'OUTBOUND'),
        status: m.status,
        content: m.content || (m.templateName ? `Template: ${m.templateName}` : ''),
        contentType: m.contentType || (m.templateName ? 'template' : 'text'),
        mediaId: m.mediaId,
        mediaUrl: m.mediaUrl,
        mediaMimeType: m.mediaMimeType,
        mediaCaption: m.mediaCaption,
        templateName: m.templateName,
        templateParameters: m.templateParameters,
        messageType: m.messageType,
        trigger: m.trigger,
        executionSource: m.executionSource,
        sentByAdminName: m.sentByAdminName,
        isInternalNote: m.isInternalNote || false,
        providerMessageId: m.providerMessageId,
        providerErrorCode: m.providerErrorCode,
        providerErrorMessage: m.providerErrorMessage,
        receivedAt: m.receivedAt || m.createdAt,
        sentAt: m.sentAt,
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
        createdAt: m.createdAt
      })),
      notes: conversation.notes || []
    });
  } catch (err) {
    console.error('[getConversationDetails Error]:', err);
    res.status(500).json({ error: 'Error fetching conversation details.', details: err.message });
  }
};

/**
 * Send human free-text reply within open 24-hour customer service window
 */
export const replyConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text, replyToMessageId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const conversation = await WhatsappConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Strict 24-Hour Customer Service Window Guard
    const nowMs = Date.now();
    const expiry = conversation.customerServiceWindowExpiresAt ? new Date(conversation.customerServiceWindowExpiresAt).getTime() : 0;
    if (expiry <= nowMs) {
      return res.status(403).json({
        error: 'CUSTOMER_SERVICE_WINDOW_EXPIRED',
        message: 'The 24-hour customer service window has expired. You must use an approved Meta template to contact this customer.'
      });
    }

    const adminId = req.user?.id || req.user?.username || 'admin';
    const adminName = req.user?.name || req.user?.username || 'Admin Support';

    const sendRes = await sendFreeTextMessage({
      recipientPhone: conversation.phone,
      text: text.trim(),
      conversationId: conversation._id,
      registrationId: conversation.registrationId,
      eventId: conversation.eventId,
      inquiryId: conversation.inquiryId,
      adminId,
      adminName,
      replyToMessageId,
      executionSource: 'ADMIN_REPLY'
    });

    res.json({
      success: sendRes.success,
      status: sendRes.status,
      providerMessageId: sendRes.providerMessageId,
      message: sendRes.messageRecord
    });
  } catch (err) {
    console.error('[replyConversation Error]:', err);
    res.status(500).json({ error: err.message || 'Error sending reply.' });
  }
};

/**
 * Send approved Meta template when 24h window is expired or for formal business updates
 */
export const templateReplyConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { templateKey, variables = {} } = req.body;

    if (!templateKey) {
      return res.status(400).json({ error: 'Template key is required.' });
    }

    const conversation = await WhatsappConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    let reg = null;
    if (conversation.registrationId) {
      reg = await Registration.findById(conversation.registrationId);
    }
    const event = conversation.eventId ? await Event.findOne({ $or: [{ id: conversation.eventId }, { slug: conversation.eventId }] }) : null;

    const customerName = reg ? `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || reg.coupleName : conversation.customerName || 'Respected Couple';

    const mergedVars = {
      customerName,
      eventName: event?.name || 'Ek Duje Ke Liye Seminar',
      eventDate: event?.date || '',
      eventTime: event?.time || '8:30 PM',
      venue: event?.venue || 'Sardar Smruti Bhavan, Surat',
      registrationId: reg?.inquiryId || conversation.inquiryId || '',
      inquiryId: reg?.inquiryId || conversation.inquiryId || '',
      ...variables
    };

    const idempotencyKey = `TEMPLATE_REPLY:${conversation._id}:${templateKey}:${Date.now()}`;
    const adminName = req.user?.name || req.user?.username || 'Admin Support';

    const sendRes = await sendUtilityTemplate({
      recipientPhone: conversation.phone,
      templateKey,
      languageCode: 'en_US',
      variables: mergedVars,
      idempotencyKey,
      registrationId: conversation.registrationId,
      eventId: conversation.eventId,
      inquiryId: conversation.inquiryId,
      trigger: 'admin_template_reply',
      executionSource: 'MANUAL_ADMIN'
    });

    if (sendRes.messageRecord?._id) {
      await WhatsappMessage.updateOne(
        { _id: sendRes.messageRecord._id },
        { $set: { conversationId: conversation._id, sentByAdminName: adminName } }
      );
      await WhatsappConversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastOutboundAt: new Date(),
            lastMessageAt: new Date(),
            lastMessagePreview: `[Template: ${templateKey}]`,
            lastMessageDirection: 'OUTBOUND',
            lastMessageStatus: sendRes.status || 'SENT'
          }
        }
      );
    }

    res.json({
      success: sendRes.success,
      status: sendRes.status,
      providerMessageId: sendRes.providerMessageId,
      message: 'Template sent successfully.'
    });
  } catch (err) {
    console.error('[templateReplyConversation Error]:', err);
    res.status(500).json({ error: err.message || 'Error sending template.' });
  }
};

/**
 * Add internal operator note to conversation (never sent to customer WhatsApp)
 */
export const addConversationNote = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Note text is required.' });
    }

    const adminId = req.user?.id || req.user?.username || 'admin';
    const adminName = req.user?.name || req.user?.username || 'Admin';

    const conversation = await WhatsappConversation.findByIdAndUpdate(
      conversationId,
      {
        $push: {
          notes: {
            text: text.trim(),
            adminId,
            adminName,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json({ success: true, notes: conversation.notes });
  } catch (err) {
    res.status(500).json({ error: 'Error adding internal note.', details: err.message });
  }
};

/**
 * Mark conversation as read internally (resets unreadCount and sets readByAdminAt)
 */
export const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await WhatsappConversation.findByIdAndUpdate(
      conversationId,
      { $set: { unreadCount: 0 } },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    await WhatsappMessage.updateMany(
      { conversationId: conversation._id, direction: 'INBOUND', readByAdminAt: null },
      { $set: { readByAdminAt: new Date() } }
    );

    res.json({ success: true, unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error marking conversation as read.', details: err.message });
  }
};

/**
 * Assign conversation to support agent
 */
export const assignConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { adminId, adminName } = req.body;

    const conversation = await WhatsappConversation.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          assignedAdminId: adminId || null,
          assignedAdminName: adminName || null
        }
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ error: 'Error assigning conversation.', details: err.message });
  }
};

/**
 * Update conversation status (OPEN / CLOSED)
 */
export const updateConversationStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be OPEN or CLOSED.' });
    }

    const conversation = await WhatsappConversation.findByIdAndUpdate(
      conversationId,
      { $set: { status } },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json({ success: true, status: conversation.status });
  } catch (err) {
    res.status(500).json({ error: 'Error updating status.', details: err.message });
  }
};

/**
 * Check or create conversation for any phone number (e.g. 8320594829) or inquiry ID,
 * backfill and link all past messages, and return the complete conversation thread.
 */
export const checkOrCreateConversationByPhone = async (req, res) => {
  try {
    const { phone, inquiryId, customerName: inputCustomerName } = req.body;
    if (!phone && !inquiryId) {
      return res.status(400).json({ error: 'Phone number or inquiryId is required.' });
    }

    let cleanPhone = phone ? normalizePhoneNumber(phone) : '';
    let targetReg = null;

    if (inquiryId) {
      targetReg = await Registration.findOne({
        $or: [
          ...(mongoose.isValidObjectId(inquiryId) ? [{ _id: inquiryId }] : []),
          { inquiryId }
        ],
        isDeleted: { $ne: true }
      }).lean();
    }

    if (!cleanPhone && targetReg?.phoneNumber) {
      cleanPhone = normalizePhoneNumber(targetReg.phoneNumber);
    }

    if (!cleanPhone && !targetReg) {
      return res.status(400).json({ error: 'Could not resolve phone number.' });
    }

    const clean10 = cleanPhone.replace(/^91/, '');
    const phoneVariants = [
      cleanPhone,
      clean10,
      `91${clean10}`,
      `+91${clean10}`,
      `+${cleanPhone}`
    ].filter(Boolean);

    if (!targetReg && cleanPhone) {
      const regs = await Registration.find({
        $or: [
          { phoneNumber: { $in: phoneVariants } },
          { phoneNumber: { $regex: clean10 + '$' } }
        ],
        isDeleted: { $ne: true }
      }).sort({ createdAt: -1 }).lean();
      targetReg = regs.find(r => r.status === 'approved' || r.status === 'pending') || regs[0] || null;
    }

    const customerName = targetReg
      ? `${targetReg.husbandName || ''} & ${targetReg.wifeName || ''} ${targetReg.surname || ''}`.trim() || targetReg.coupleName || 'Respected Couple'
      : (inputCustomerName || maskPhoneNumber(cleanPhone) || 'WhatsApp Guest');

    // Find existing conversation
    let conversation = await WhatsappConversation.findOne({
      $or: [
        { phone: { $in: phoneVariants } },
        ...(targetReg ? [{ registrationId: targetReg._id }] : []),
        ...(targetReg?.inquiryId ? [{ inquiryId: targetReg.inquiryId }] : [])
      ]
    });

    if (!conversation) {
      conversation = await WhatsappConversation.create({
        phone: cleanPhone,
        phoneMasked: maskPhoneNumber(cleanPhone),
        phoneHash: hashPhoneNumber(cleanPhone),
        registrationId: targetReg?._id || null,
        inquiryId: targetReg?.inquiryId || inquiryId || null,
        eventId: targetReg?.programId || null,
        customerName,
        status: 'OPEN',
        unreadCount: 0,
        lastMessageAt: new Date(),
        lastMessagePreview: 'Conversation opened',
        lastMessageDirection: 'OUTBOUND',
        lastMessageStatus: 'OPEN',
        lastOutboundAt: null
      });
    } else {
      if (targetReg && !conversation.registrationId) {
        conversation.registrationId = targetReg._id;
        conversation.inquiryId = targetReg.inquiryId;
        conversation.eventId = targetReg.programId;
        conversation.customerName = customerName;
        await conversation.save();
      }
    }

    // Link all historical unlinked messages for this phone/registration
    await WhatsappMessage.updateMany(
      {
        $or: [
          { recipientPhone: { $in: phoneVariants } },
          { senderPhone: { $in: phoneVariants } },
          ...(targetReg ? [{ registrationId: targetReg._id }] : []),
          ...(targetReg?.inquiryId ? [{ inquiryId: targetReg.inquiryId }] : [])
        ],
        conversationId: null
      },
      { $set: { conversationId: conversation._id } }
    );

    // Fetch full messages
    const messages = await WhatsappMessage.find({
      $or: [
        { conversationId: conversation._id },
        { recipientPhone: { $in: phoneVariants } },
        { senderPhone: { $in: phoneVariants } }
      ]
    }).sort({ createdAt: 1 }).lean();

    // If there are messages, update lastMessage preview & timestamps
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      await WhatsappConversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessageAt: lastMsg.createdAt,
            lastMessagePreview: lastMsg.content || (lastMsg.templateName ? `Template: ${lastMsg.templateName}` : 'Message'),
            lastMessageDirection: lastMsg.direction || (lastMsg.executionSource === 'INBOUND_WEBHOOK' ? 'INBOUND' : 'OUTBOUND'),
            lastMessageStatus: lastMsg.status || 'SENT'
          }
        }
      );
    }

    res.json({
      success: true,
      conversationId: conversation._id,
      conversation,
      totalMessages: messages.length
    });
  } catch (err) {
    console.error('[checkOrCreateConversationByPhone Error]:', err);
    res.status(500).json({ error: 'Failed to check or create conversation.', details: err.message });
  }
};

/**
 * One-click Sync & Repair: Scan all WhatsappMessage records and Registration records,
 * create missing WhatsappConversation entries, link orphaned messages, and update previews.
 */
export const syncHistoricalConversations = async (req, res) => {
  try {
    const allMessages = await WhatsappMessage.find().sort({ createdAt: 1 }).lean();
    const phoneMap = new Map();

    for (const msg of allMessages) {
      const phone = normalizePhoneNumber(msg.direction === 'INBOUND' ? msg.senderPhone : msg.recipientPhone);
      if (!phone || phone.length < 10) continue;
      if (!phoneMap.has(phone)) phoneMap.set(phone, []);
      phoneMap.get(phone).push(msg);
    }

    // Also collect all registrations
    const allRegs = await Registration.find({ isDeleted: { $ne: true } }).lean();
    for (const reg of allRegs) {
      const phone = normalizePhoneNumber(reg.phoneNumber);
      if (phone && phone.length >= 10 && !phoneMap.has(phone)) {
        phoneMap.set(phone, []);
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let linkedMessagesCount = 0;

    for (const [phone, msgs] of phoneMap.entries()) {
      const clean10 = phone.replace(/^91/, '');
      const phoneVariants = [phone, clean10, `91${clean10}`, `+91${clean10}`, `+${phone}`];

      // Find matching registration
      const reg = allRegs.find(r => phoneVariants.includes(normalizePhoneNumber(r.phoneNumber))) || null;
      const customerName = reg
        ? `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim() || reg.coupleName || 'Respected Couple'
        : maskPhoneNumber(phone) || 'WhatsApp Guest';

      let conversation = await WhatsappConversation.findOne({
        $or: [
          { phone: { $in: phoneVariants } },
          ...(reg ? [{ registrationId: reg._id }] : [])
        ]
      });

      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const unreadCount = msgs.filter(m => m.direction === 'INBOUND' && !m.readByAdminAt).length;

      if (!conversation) {
        conversation = await WhatsappConversation.create({
          phone,
          phoneMasked: maskPhoneNumber(phone),
          phoneHash: hashPhoneNumber(phone),
          registrationId: reg?._id || null,
          inquiryId: reg?.inquiryId || null,
          eventId: reg?.programId || null,
          customerName,
          status: 'OPEN',
          unreadCount,
          lastMessageAt: lastMsg ? lastMsg.createdAt : new Date(),
          lastMessagePreview: lastMsg ? (lastMsg.content || (lastMsg.templateName ? `Template: ${lastMsg.templateName}` : 'Synced chat')) : 'Synced Registration',
          lastMessageDirection: lastMsg ? (lastMsg.direction || (lastMsg.executionSource === 'INBOUND_WEBHOOK' ? 'INBOUND' : 'OUTBOUND')) : 'OUTBOUND',
          lastMessageStatus: lastMsg ? lastMsg.status : 'RECEIVED',
          lastInboundAt: msgs.filter(m => m.direction === 'INBOUND').pop()?.createdAt || null,
          lastOutboundAt: msgs.filter(m => m.direction === 'OUTBOUND').pop()?.createdAt || null
        });
        createdCount++;
      } else {
        const updateFields = {};
        if (reg && !conversation.registrationId) {
          updateFields.registrationId = reg._id;
          updateFields.inquiryId = reg.inquiryId;
          updateFields.eventId = reg.programId;
          updateFields.customerName = customerName;
        }
        if (lastMsg) {
          updateFields.lastMessageAt = lastMsg.createdAt;
          updateFields.lastMessagePreview = lastMsg.content || (lastMsg.templateName ? `Template: ${lastMsg.templateName}` : 'Synced chat');
          updateFields.lastMessageDirection = lastMsg.direction || (lastMsg.executionSource === 'INBOUND_WEBHOOK' ? 'INBOUND' : 'OUTBOUND');
          updateFields.lastMessageStatus = lastMsg.status;
        }
        updateFields.unreadCount = unreadCount;
        await WhatsappConversation.updateOne({ _id: conversation._id }, { $set: updateFields });
        updatedCount++;
      }

      // Link unlinked messages
      const msgIdsToLink = msgs.filter(m => !m.conversationId || String(m.conversationId) !== String(conversation._id)).map(m => m._id);
      if (msgIdsToLink.length > 0) {
        await WhatsappMessage.updateMany(
          { _id: { $in: msgIdsToLink } },
          { $set: { conversationId: conversation._id } }
        );
        linkedMessagesCount += msgIdsToLink.length;
      }
    }

    res.json({
      success: true,
      summary: {
        totalPhones: phoneMap.size,
        createdConversations: createdCount,
        updatedConversations: updatedCount,
        linkedMessages: linkedMessagesCount
      }
    });
  } catch (err) {
    console.error('[syncHistoricalConversations Error]:', err);
    res.status(500).json({ error: 'Failed to sync historical conversations.', details: err.message });
  }
};

/**
 * Inbound Webhook Test Simulator:
 * Simulate receiving an inbound WhatsApp message from any number (e.g. 8320594829)
 * to verify two-way chat, 24-hour service window, and real-time inbox without waiting for Meta.
 */
export const simulateInboundMessage = async (req, res) => {
  try {
    const { phone, text, customerName: inputName } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    const msgText = (text || 'Hello! I have a question about my seminar pass.').trim();
    const cleanPhone = normalizePhoneNumber(phone);
    const clean10 = cleanPhone.replace(/^91/, '');
    const phoneVariants = [cleanPhone, clean10, `91${clean10}`, `+91${clean10}`, `+${cleanPhone}`];

    // Find registration
    const reg = await Registration.findOne({
      $or: [
        { phoneNumber: { $in: phoneVariants } },
        { phoneNumber: { $regex: clean10 + '$' } }
      ],
      isDeleted: { $ne: true }
    }).lean();

    const customerName = reg
      ? `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim() || reg.coupleName || 'Respected Couple'
      : (inputName || maskPhoneNumber(cleanPhone) || 'WhatsApp Guest');

    const now = new Date();
    const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let conversation = await WhatsappConversation.findOne({
      $or: [
        { phone: { $in: phoneVariants } },
        ...(reg ? [{ registrationId: reg._id }] : [])
      ]
    });

    if (!conversation) {
      conversation = await WhatsappConversation.create({
        phone: cleanPhone,
        phoneMasked: maskPhoneNumber(cleanPhone),
        phoneHash: hashPhoneNumber(cleanPhone),
        registrationId: reg?._id || null,
        inquiryId: reg?.inquiryId || null,
        eventId: reg?.programId || null,
        customerName,
        status: 'OPEN',
        unreadCount: 1,
        lastMessageAt: now,
        lastMessagePreview: msgText,
        lastMessageDirection: 'INBOUND',
        lastMessageStatus: 'RECEIVED',
        lastInboundAt: now,
        customerServiceWindowExpiresAt: windowExpiry
      });
    } else {
      conversation.status = 'OPEN';
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
      conversation.lastMessageAt = now;
      conversation.lastMessagePreview = msgText;
      conversation.lastMessageDirection = 'INBOUND';
      conversation.lastMessageStatus = 'RECEIVED';
      conversation.lastInboundAt = now;
      conversation.customerServiceWindowExpiresAt = windowExpiry;
      if (reg && !conversation.registrationId) {
        conversation.registrationId = reg._id;
        conversation.inquiryId = reg.inquiryId;
        conversation.eventId = reg.programId;
        conversation.customerName = customerName;
      }
      await conversation.save();
    }

    const mockWamid = `wamid.SIMULATED_${Date.now()}`;
    const messageRecord = await WhatsappMessage.create({
      messageId: `WA-IN-${mockWamid}`,
      conversationId: conversation._id,
      direction: 'INBOUND',
      eventId: conversation.eventId,
      registrationId: conversation.registrationId,
      inquiryId: conversation.inquiryId,
      recipientPhone: normalizePhoneNumber(env.WHATSAPP_PHONE_NUMBER_ID || '1212458621961809'),
      recipientMasked: maskPhoneNumber(env.WHATSAPP_PHONE_NUMBER_ID || '1212458621961809'),
      recipientHash: hashPhoneNumber(env.WHATSAPP_PHONE_NUMBER_ID || '1212458621961809'),
      senderPhone: cleanPhone,
      senderMasked: maskPhoneNumber(cleanPhone),
      content: msgText,
      contentType: 'text',
      messageType: 'chat_message',
      executionSource: 'INBOUND_WEBHOOK',
      providerMode: 'MOCK',
      idempotencyKey: `SIMULATED:${mockWamid}`,
      status: 'RECEIVED',
      providerMessageId: mockWamid,
      receivedAt: now
    });

    res.json({
      success: true,
      conversationId: conversation._id,
      message: messageRecord,
      windowExpiresAt: windowExpiry
    });
  } catch (err) {
    console.error('[simulateInboundMessage Error]:', err);
    res.status(500).json({ error: 'Failed to simulate inbound message.', details: err.message });
  }
};
