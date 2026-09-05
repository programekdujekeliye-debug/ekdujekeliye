import crypto from 'crypto';
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
