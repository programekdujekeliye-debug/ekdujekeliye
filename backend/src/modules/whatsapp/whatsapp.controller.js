import { verifyWebhook, handleWebhookEvent, sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';
import { WhatsappTemplate } from '../../models/WhatsappTemplate.js';
import { CORE_TEMPLATES } from '../../integrations/whatsapp/templateRegistry.js';

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

import mongoose from 'mongoose';
import { Registration } from '../../models/Registration.js';
import { WhatsappMessage } from '../../models/WhatsappMessage.js';

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

/**
 * Get complete communication timeline for a specific registration
 */
export const getRegistrationTimeline = async (req, res) => {
  const { inquiryId } = req.params;
  if (!inquiryId) return res.status(400).json({ error: 'Inquiry ID is required.' });

  try {
    const reg = await Registration.findOne({ inquiryId: { $regex: new RegExp(`^${inquiryId.trim()}$`, 'i') } }).lean();
    if (!reg) return res.status(404).json({ error: 'Registration not found.' });

    const messages = await WhatsappMessage.find({
      $or: [
        { inquiryId: reg.inquiryId },
        { registrationId: reg._id }
      ]
    }).sort({ createdAt: 1 }).lean();

    const timeline = messages.map(m => ({
      id: m._id,
      messageId: m.messageId,
      templateName: m.templateName,
      messageType: m.messageType,
      trigger: m.trigger,
      status: m.status,
      scheduledFor: m.scheduledFor,
      sentAt: m.sentAt,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      failedAt: m.failedAt,
      lastErrorMessage: m.lastErrorMessage,
      providerMessageId: m.providerMessageId,
      createdAt: m.createdAt
    }));

    res.json({
      success: true,
      inquiryId: reg.inquiryId,
      customerName: `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim(),
      attendance: reg.attendance,
      invitationVersion: reg.invitationVersion || 1,
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching communication timeline.', details: err.message });
  }
};

/**
 * Get Event Communication Dashboard with aggregate counts (No N+1)
 */
export const getEventCommunicationDashboard = async (req, res) => {
  const { eventId } = req.params;
  if (!eventId) return res.status(400).json({ error: 'Event ID is required.' });

  try {
    const confirmedRegistrations = await Registration.countDocuments({
      programId: eventId,
      status: 'approved',
      isDeleted: false
    });

    const attendedRegistrations = await Registration.countDocuments({
      programId: eventId,
      status: 'approved',
      $or: [{ attendance: 'PRESENT' }, { attendance: 'present' }, { attendance: true }]
    });

    // Grouped aggregation by messageType and status
    const breakdown = await WhatsappMessage.aggregate([
      { $match: { eventId } },
      {
        $group: {
          _id: { messageType: '$messageType', status: '$status' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      confirmedRegistrations,
      attendedRegistrations,
      messageTypes: {
        registration_received: { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        payment_confirmation: { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        pass_delivery: { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        invitation: { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        reminder: { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        feedback_request: { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 }
      }
    };

    breakdown.forEach(item => {
      const type = item._id?.messageType;
      const status = (item._id?.status || '').toLowerCase();
      if (stats.messageTypes[type]) {
        if (stats.messageTypes[type][status] !== undefined) {
          stats.messageTypes[type][status] += item.count;
        }
      }
    });

    res.json({ success: true, eventId, dashboard: stats });
  } catch (err) {
    res.status(500).json({ error: 'Error generating communication dashboard.', details: err.message });
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

import { communicationSchedulerService } from '../../services/communicationScheduler.service.js';
import { invitationCardService } from '../../services/invitationCard.service.js';
