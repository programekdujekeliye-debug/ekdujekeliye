import mongoose from 'mongoose';
import { WhatsappMessage } from '../../models/WhatsappMessage.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { env } from '../../config/env.js';
import { sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';
import { TEMPLATE_REGISTRY } from '../../integrations/whatsapp/templateRegistry.js';

/**
 * Get high-level WhatsApp broadcast campaign metrics & recent campaigns
 */
export const getBroadcastOverview = async (req, res) => {
  try {
    const broadcastFilter = {
      $or: [
        { trigger: 'marketing_broadcast' },
        { templateCategory: 'MARKETING' },
        { idempotencyKey: { $regex: '^MKT_BROADCAST' } }
      ]
    };

    const [totalMessages, statusAgg, recentMessages] = await Promise.all([
      WhatsappMessage.countDocuments(broadcastFilter),
      WhatsappMessage.aggregate([
        { $match: broadcastFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      WhatsappMessage.find(broadcastFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    const statusCounts = {
      SENT: 0,
      DELIVERED: 0,
      READ: 0,
      FAILED: 0,
      SENDING: 0
    };

    statusAgg.forEach(item => {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
    });

    // Effective delivered = DELIVERED + READ
    const effectiveDelivered = statusCounts.DELIVERED + statusCounts.READ;
    const deliveredRate = totalMessages > 0
      ? Math.min(100, Math.round(((effectiveDelivered + statusCounts.SENT) / totalMessages) * 100))
      : 0;
    const readRate = totalMessages > 0
      ? Math.round((statusCounts.READ / totalMessages) * 100)
      : 0;

    // Group into campaigns by template and date
    const campaignsAgg = await WhatsappMessage.aggregate([
      { $match: broadcastFilter },
      {
        $group: {
          _id: '$templateName',
          totalRecipients: { $sum: 1 },
          sentCount: {
            $sum: { $cond: [{ $in: ['$status', ['SENT', 'DELIVERED', 'READ']] }, 1, 0] }
          },
          deliveredCount: {
            $sum: { $cond: [{ $in: ['$status', ['DELIVERED', 'READ']] }, 1, 0] }
          },
          readCount: {
            $sum: { $cond: [{ $eq: ['$status', 'READ'] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
          },
          sendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'SENDING'] }, 1, 0] }
          },
          firstSentAt: { $min: '$createdAt' },
          lastSentAt: { $max: '$createdAt' }
        }
      },
      { $sort: { lastSentAt: -1 } }
    ]);

    const campaigns = campaignsAgg.map(c => {
      const templateDef = TEMPLATE_REGISTRY[c._id];
      const isLiveNow = c.sendingCount > 0 || (c.lastSentAt && (Date.now() - new Date(c.lastSentAt).getTime()) < 60000);
      return {
        id: `camp_${c._id || 'general'}`,
        templateName: c._id || 'edkl_all_couples_invite_v1',
        title: templateDef?.purpose || 'General Couple Seminar Invitation & Gift Broadcast',
        category: 'MARKETING',
        audience: 'TBD & Past Pending Inquiries (Excl. Upcoming)',
        totalRecipients: c.totalRecipients,
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        readCount: c.readCount,
        failedCount: c.failedCount,
        sendingCount: c.sendingCount,
        status: isLiveNow ? 'SENDING' : 'COMPLETED',
        startedAt: c.firstSentAt,
        lastSentAt: c.lastSentAt
      };
    });

    res.json({
      summary: {
        totalCampaigns: campaigns.length,
        totalBroadcastMessages: totalMessages,
        sent: statusCounts.SENT,
        delivered: statusCounts.DELIVERED,
        read: statusCounts.READ,
        failed: statusCounts.FAILED,
        sending: statusCounts.SENDING,
        deliveredRate,
        readRate
      },
      campaigns,
      recentActivity: recentMessages.map(m => ({
        id: m._id,
        recipientPhone: m.recipientPhone,
        recipientMasked: m.recipientMasked,
        customerName: m.templateParameters?.customerName || 'Respected Couple',
        status: m.status,
        providerMessageId: m.providerMessageId,
        sentAt: m.sentAt || m.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching broadcast overview:', err);
    res.status(500).json({ error: 'Failed to fetch broadcast overview metrics.' });
  }
};

/**
 * Get paginated, searchable logs of broadcast messages
 */
export const getBroadcastLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      status = 'ALL',
      search = '',
      campaign = ''
    } = req.query;

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

    const filter = {
      $or: [
        { trigger: 'marketing_broadcast' },
        { templateCategory: 'MARKETING' },
        { idempotencyKey: { $regex: '^MKT_BROADCAST' } }
      ]
    };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (campaign) {
      filter.templateName = campaign;
    }

    if (search && search.trim()) {
      const s = search.trim();
      const cleanPhone = s.replace(/\D/g, '');
      const searchOr = [
        { recipientPhone: { $regex: s, $options: 'i' } },
        { recipientMasked: { $regex: s, $options: 'i' } },
        { 'templateParameters.customerName': { $regex: s, $options: 'i' } },
        { providerMessageId: { $regex: s, $options: 'i' } },
        { inquiryId: { $regex: s, $options: 'i' } }
      ];
      if (cleanPhone) {
        searchOr.push({ recipientPhone: { $regex: cleanPhone } });
      }
      filter.$and = [{ $or: searchOr }];
    }

    const [total, logs] = await Promise.all([
      WhatsappMessage.countDocuments(filter),
      WhatsappMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
    ]);

    res.json({
      logs: logs.map(m => ({
        id: m._id,
        messageId: m.messageId,
        providerMessageId: m.providerMessageId || '-',
        recipientPhone: m.recipientPhone,
        recipientMasked: m.recipientMasked || m.recipientPhone,
        customerName: m.templateParameters?.customerName || 'Respected Couple',
        inquiryId: m.inquiryId || '-',
        templateName: m.templateName || 'edkl_all_couples_invite_v1',
        content: m.content,
        status: m.status,
        sentAt: m.sentAt || m.createdAt,
        updatedAt: m.updatedAt
      })),
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1
      }
    });
  } catch (err) {
    console.error('Error fetching broadcast logs:', err);
    res.status(500).json({ error: 'Failed to fetch broadcast logs.' });
  }
};

/**
 * Launch or test a new marketing broadcast campaign from Super Admin
 */
export const launchBroadcastCampaign = async (req, res) => {
  try {
    const {
      templateKey = 'edkl_all_couples_invite_v1',
      audienceCohort = 'TBD_AND_PAST_PENDING',
      testOnly = false,
      testRecipientPhone = ''
    } = req.body;

    const templateDef = TEMPLATE_REGISTRY[templateKey];
    if (!templateDef) {
      return res.status(400).json({ error: `Template '${templateKey}' is not registered.` });
    }

    // Handle single test dispatch to admin number
    if (testOnly) {
      const targetPhone = testRecipientPhone || '918320594829';
      const cleanPhone = String(targetPhone).replace(/\D/g, '').slice(-10);
      if (!cleanPhone || cleanPhone.length !== 10) {
        return res.status(400).json({ error: 'Please provide a valid 10-digit test phone number.' });
      }

      const testResult = await sendUtilityTemplate({
        recipientPhone: `91${cleanPhone}`,
        templateKey,
        languageCode: 'en_US',
        variables: {
          customerName: 'Jayneshbhai (Test)'
        },
        trigger: 'marketing_test',
        category: 'MARKETING'
      });

      return res.json({
        success: testResult.success,
        mode: 'TEST_DISPATCH',
        recipientPhone: `91${cleanPhone}`,
        providerMessageId: testResult.providerMessageId,
        message: testResult.success ? 'Test message sent successfully to your WhatsApp!' : testResult.error
      });
    }

    // Safety guard: Find target cohort strictly excluding upcoming active events
    const upcomingIds = ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19'];
    const upcomingDates = ['2026-09-07', '2026-09-11', '2026-09-19'];

    let targetFilter = {};
    if (audienceCohort === 'TBD_AND_PAST_PENDING') {
      targetFilter = {
        programId: { $nin: upcomingIds },
        programDate: { $nin: upcomingDates },
        inquiryId: { $not: /^(EK06|EK07|EK08)/ },
        status: { $in: ['pending', 'inquiry'] },
        isDeleted: { $ne: true }
      };
    } else {
      return res.status(400).json({ error: 'Invalid audience cohort specified.' });
    }

    const targetSubmissions = await Registration.find(targetFilter).lean();

    // Deduplicate by 10-digit phone
    const phoneMap = new Map();
    targetSubmissions.forEach(sub => {
      const clean = String(sub.phoneNumber || '').replace(/\D/g, '').slice(-10);
      if (clean && clean.length === 10 && !phoneMap.has(clean)) {
        phoneMap.set(clean, sub);
      }
    });

    const uniqueRecipients = Array.from(phoneMap.values());

    // Trigger async background processing without blocking request
    setImmediate(async () => {
      env.APP_ENV = 'production';
      env.WHATSAPP_MODE = 'production';

      for (let i = 0; i < uniqueRecipients.length; i++) {
        const record = uniqueRecipients[i];
        const cleanPhone = String(record.phoneNumber || '').replace(/\D/g, '').slice(-10);
        const coupleName = `${record.husbandName || ''} & ${record.wifeName || ''}`.trim() || 'Respected Couple';

        try {
          await sendUtilityTemplate({
            recipientPhone: `91${cleanPhone}`,
            templateKey,
            languageCode: 'en_US',
            variables: { customerName: coupleName },
            idempotencyKey: `MKT_BROADCAST_UI_${Date.now()}:${record.inquiryId || cleanPhone}`,
            trigger: 'marketing_broadcast',
            category: 'MARKETING'
          });
        } catch (e) {
          console.error(`Broadcast error for ${cleanPhone}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 100));
      }
    });

    res.json({
      success: true,
      message: `Broadcast campaign started in background for ${uniqueRecipients.length} unique recipients.`,
      recipientCount: uniqueRecipients.length
    });

  } catch (err) {
    console.error('Error launching broadcast campaign:', err);
    res.status(500).json({ error: 'Failed to launch broadcast campaign.' });
  }
};
