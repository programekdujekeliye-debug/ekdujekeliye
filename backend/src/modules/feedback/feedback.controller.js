import crypto from 'crypto';
import mongoose from 'mongoose';
import { Feedback } from '../../models/Feedback.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { eventService } from '../events/event.service.js';

/**
 * Get feedback form details by secure token
 */
export async function getFeedbackForm(req, res) {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const rawClean = String(token).trim();
    let feedback = await Feedback.findOne({
      $or: [{ token: rawClean }, { inquiryId: rawClean.toUpperCase() }]
    });

    if (!feedback) {
      // Automatic lookup via Registration inquiryId or customerToken
      const reg = await Registration.findOne({
        $or: [
          { inquiryId: rawClean.toUpperCase() },
          { customerToken: rawClean }
        ],
        isDeleted: { $ne: true }
      });

      if (!reg) {
        return res.status(404).json({ error: 'Feedback form not found or link has expired.' });
      }

      const coupleName = reg.husbandName && reg.wifeName
        ? `${reg.husbandName} & ${reg.wifeName} ${reg.surname || ''}`.trim()
        : (reg.husbandName || reg.wifeName || 'Respected Couple');

      feedback = await ensureFeedbackToken(reg.inquiryId, reg.programId, coupleName);
    }

    const event = await eventService.getEventBySlug(feedback.eventId);

    return res.json({
      token: feedback.token,
      inquiryId: feedback.inquiryId,
      coupleName: feedback.coupleName,
      eventName: event?.name || 'Ek Duje Ke Liye Seminar',
      eventDate: event?.date || '',
      eventTime: event?.time || '8:30 PM',
      eventVenue: event?.venue || 'Sardar Patel Smruti Bhavan, Surat',
      isSubmitted: feedback.isSubmitted,
      overallRating: feedback.overallRating || 5,
      contentRating: feedback.contentRating || 5,
      speakerRating: feedback.speakerRating || 5,
      venueRating: feedback.venueRating || 5,
      wouldRecommend: feedback.wouldRecommend !== false,
      feedbackText: feedback.feedbackText || '',
      keyTakeaways: feedback.keyTakeaways || [],
      connectionRating: feedback.connectionRating || 'MUCH_CLOSER',
      isTestimonialAllowed: feedback.isSubmitted ? (feedback.isTestimonialAllowed ?? true) : true
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve feedback form.' });
  }
}

/**
 * Submit feedback
 */
export async function submitFeedback(req, res) {
  const { token } = req.params;
  const {
    overallRating,
    contentRating,
    speakerRating,
    venueRating,
    wouldRecommend,
    feedbackText,
    keyTakeaways,
    connectionRating,
    isTestimonialAllowed
  } = req.body;

  try {
    const rawClean = String(token).trim();
    let feedback = await Feedback.findOne({
      $or: [{ token: rawClean }, { inquiryId: rawClean.toUpperCase() }]
    });

    if (!feedback) {
      const reg = await Registration.findOne({
        $or: [
          { inquiryId: rawClean.toUpperCase() },
          { customerToken: rawClean }
        ]
      });
      if (reg) {
        const coupleName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim();
        feedback = await ensureFeedbackToken(reg.inquiryId, reg.programId, coupleName);
      }
    }

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback form not found.' });
    }

    feedback.overallRating = Math.max(1, Math.min(5, Number(overallRating) || 5));
    feedback.contentRating = Math.max(1, Math.min(5, Number(contentRating) || 5));
    feedback.speakerRating = Math.max(1, Math.min(5, Number(speakerRating) || 5));
    feedback.venueRating = Math.max(1, Math.min(5, Number(venueRating) || 5));
    feedback.wouldRecommend = wouldRecommend !== false;
    feedback.feedbackText = String(feedbackText || '').trim();

    if (Array.isArray(keyTakeaways)) {
      feedback.keyTakeaways = keyTakeaways.map(t => String(t).trim()).filter(Boolean);
    }
    if (connectionRating) {
      feedback.connectionRating = String(connectionRating).trim();
    }
    if (isTestimonialAllowed !== undefined) {
      feedback.isTestimonialAllowed = Boolean(isTestimonialAllowed);
    }

    feedback.isSubmitted = true;
    feedback.submittedAt = new Date();

    await feedback.save();

    return res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit feedback.' });
  }
}

/**
 * Ensure feedback record exists for attendee
 */
export async function ensureFeedbackToken(inquiryId, eventId, coupleName) {
  let record = await Feedback.findOne({ inquiryId, eventId });
  if (!record) {
    const token = crypto.randomBytes(16).toString('hex');
    record = await Feedback.create({
      inquiryId,
      eventId,
      token,
      coupleName
    });
  }
  return record;
}

/**
 * Super Admin: Get aggregated statistics and analytics for feedback
 */
export async function getAdminFeedbackStats(req, res) {
  try {
    const { eventId } = req.query;
    const matchFilter = {};
    if (eventId && eventId !== 'all') {
      matchFilter.eventId = eventId;
    }

    const totalGenerated = await Feedback.countDocuments(matchFilter);
    const totalSubmitted = await Feedback.countDocuments({ ...matchFilter, isSubmitted: true });
    const totalPending = totalGenerated - totalSubmitted;
    const submissionRate = totalGenerated > 0 ? Math.round((totalSubmitted / totalGenerated) * 100) : 0;

    // Aggregations on submitted reviews
    const submittedMatch = { ...matchFilter, isSubmitted: true };
    const submittedRecords = await Feedback.find(submittedMatch).lean();

    let sumOverall = 0;
    let sumVenue = 0;
    let countWouldRecommend = 0;
    let testimonialCount = 0;
    let withCommentsCount = 0;

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const connectionBreakdown = { MUCH_CLOSER: 0, REFRESHED: 0, HELPFUL: 0, GOOD: 0 };
    const takeawaysFrequency = {};

    for (const fb of submittedRecords) {
      const overall = fb.overallRating || 5;
      const venue = fb.venueRating || 5;
      sumOverall += overall;
      sumVenue += venue;

      if (ratingDistribution[overall] !== undefined) {
        ratingDistribution[overall]++;
      }

      if (fb.connectionRating && connectionBreakdown[fb.connectionRating] !== undefined) {
        connectionBreakdown[fb.connectionRating]++;
      }

      if (Array.isArray(fb.keyTakeaways)) {
        for (const t of fb.keyTakeaways) {
          takeawaysFrequency[t] = (takeawaysFrequency[t] || 0) + 1;
        }
      }

      if (fb.wouldRecommend !== false) {
        countWouldRecommend++;
      }

      if (fb.isTestimonialAllowed) {
        testimonialCount++;
      }

      if (fb.feedbackText && fb.feedbackText.trim().length > 0) {
        withCommentsCount++;
      }
    }

    const averageOverallRating = totalSubmitted > 0 ? Number((sumOverall / totalSubmitted).toFixed(1)) : 5.0;
    const averageVenueRating = totalSubmitted > 0 ? Number((sumVenue / totalSubmitted).toFixed(1)) : 5.0;
    const recommendationRate = totalSubmitted > 0 ? Math.round((countWouldRecommend / totalSubmitted) * 100) : 100;
    const testimonialRate = totalSubmitted > 0 ? Math.round((testimonialCount / totalSubmitted) * 100) : 0;

    return res.json({
      success: true,
      stats: {
        totalGenerated,
        totalSubmitted,
        totalPending,
        submissionRate,
        averageOverallRating,
        averageVenueRating,
        recommendationRate,
        testimonialCount,
        testimonialRate,
        withCommentsCount,
        ratingDistribution,
        connectionBreakdown,
        takeawaysFrequency
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to compute feedback statistics.' });
  }
}

/**
 * Super Admin: Get paginated list of feedback records with search & filters
 */
export async function getAdminFeedbackList(req, res) {
  try {
    const {
      eventId,
      status = 'all',
      rating = 'all',
      testimonial = 'all',
      search = '',
      page = 1,
      limit = 25
    } = req.query;

    const query = {};

    if (eventId && eventId !== 'all') {
      query.eventId = eventId;
    }

    if (status === 'submitted') {
      query.isSubmitted = true;
    } else if (status === 'pending') {
      query.isSubmitted = false;
    }

    if (rating !== 'all') {
      if (rating === 'low') {
        query.overallRating = { $lte: 2 };
      } else {
        query.overallRating = Number(rating);
      }
    }

    if (testimonial === 'allowed') {
      query.isTestimonialAllowed = true;
    } else if (testimonial === 'not_allowed') {
      query.isTestimonialAllowed = false;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { coupleName: { $regex: term, $options: 'i' } },
        { inquiryId: { $regex: term, $options: 'i' } },
        { feedbackText: { $regex: term, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const skip = (pageNum - 1) * limitNum;

    const total = await Feedback.countDocuments(query);
    const feedbacks = await Feedback.find(query)
      .sort({ isSubmitted: -1, submittedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Enrich feedbacks with registration phone, couplePhoto, attendance
    const inquiryIds = feedbacks.map(f => f.inquiryId).filter(Boolean);
    const registrations = await Registration.find({
      inquiryId: { $in: inquiryIds },
      isDeleted: { $ne: true }
    }).select('inquiryId phoneNumber couplePhoto attendance programDate programName husbandName wifeName surname').lean();

    const regMap = new Map();
    for (const r of registrations) {
      regMap.set(r.inquiryId, r);
    }

    const enriched = feedbacks.map(fb => {
      const reg = regMap.get(fb.inquiryId);
      return {
        ...fb,
        phoneNumber: reg?.phoneNumber || '',
        couplePhoto: reg?.couplePhoto || '',
        attendance: reg?.attendance || 'unmarked',
        programDate: reg?.programDate || '',
        programName: reg?.programName || ''
      };
    });

    return res.json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve feedback list.' });
  }
}

/**
 * Super Admin: Toggle website testimonial permission
 */
export async function toggleTestimonialPermission(req, res) {
  try {
    const { id } = req.params;
    let filter;
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter = { $or: [{ _id: id }, { token: id }, { inquiryId: id.toUpperCase() }] };
    } else {
      filter = { $or: [{ token: id }, { inquiryId: id.toUpperCase() }] };
    }

    const feedback = await Feedback.findOne(filter);

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback record not found.' });
    }

    feedback.isTestimonialAllowed = !feedback.isTestimonialAllowed;
    await feedback.save();

    return res.json({
      success: true,
      isTestimonialAllowed: feedback.isTestimonialAllowed,
      message: `Testimonial permission set to ${feedback.isTestimonialAllowed ? 'Allowed' : 'Private'}`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle testimonial permission.' });
  }
}

/**
 * Super Admin: Delete feedback record
 */
export async function deleteFeedbackRecord(req, res) {
  try {
    const { id } = req.params;
    let filter;
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter = { $or: [{ _id: id }, { token: id }, { inquiryId: id.toUpperCase() }] };
    } else {
      filter = { $or: [{ token: id }, { inquiryId: id.toUpperCase() }] };
    }

    const deleted = await Feedback.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({ error: 'Feedback record not found.' });
    }

    return res.json({ success: true, message: 'Feedback record deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete feedback record.' });
  }
}

/**
 * Super Admin: Export feedback records as CSV or JSON
 */
export async function exportFeedbackData(req, res) {
  try {
    const { eventId, format = 'csv' } = req.query;
    const query = { isSubmitted: true };
    if (eventId && eventId !== 'all') {
      query.eventId = eventId;
    }

    const records = await Feedback.find(query).sort({ submittedAt: -1 }).lean();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=feedbacks-${eventId || 'all'}.json`);
      return res.send(JSON.stringify(records, null, 2));
    }

    // CSV format
    const headers = [
      'Inquiry ID',
      'Couple Name',
      'Event ID',
      'Overall Rating',
      'Venue Rating',
      'Would Recommend',
      'Connection Rating',
      'Key Takeaways',
      'Website Testimonial Allowed',
      'Feedback Comments',
      'Submitted At'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = records.map(r => [
      escapeCsv(r.inquiryId),
      escapeCsv(r.coupleName),
      escapeCsv(r.eventId),
      r.overallRating || 5,
      r.venueRating || 5,
      r.wouldRecommend ? 'Yes' : 'No',
      escapeCsv(r.connectionRating || ''),
      escapeCsv((r.keyTakeaways || []).join('; ')),
      r.isTestimonialAllowed ? 'Yes' : 'No',
      escapeCsv(r.feedbackText || ''),
      r.submittedAt ? new Date(r.submittedAt).toISOString() : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=feedbacks-${eventId || 'all'}.csv`);
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export feedback data.' });
  }
}

/**
 * Public: Get approved couple testimonials for website showcase
 */
export async function getPublicTestimonials(req, res) {
  try {
    const { eventId, limit = 12 } = req.query;
    const filter = {
      isSubmitted: true,
      isTestimonialAllowed: true,
      feedbackText: { $exists: true, $ne: '' }
    };
    if (eventId && eventId !== 'all') {
      filter.eventId = eventId;
    }

    const reviews = await Feedback.find(filter)
      .sort({ overallRating: -1, submittedAt: -1 })
      .limit(Math.min(50, parseInt(limit) || 12))
      .select('coupleName eventId overallRating venueRating feedbackText keyTakeaways connectionRating submittedAt')
      .lean();

    return res.json({
      success: true,
      count: reviews.length,
      testimonials: reviews
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch public testimonials.' });
  }
}
