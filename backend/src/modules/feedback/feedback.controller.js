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
    const feedback = await Feedback.findOne({ token });
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback form not found or expired.' });
    }

    const event = await eventService.getEventBySlug(feedback.eventId);

    return res.json({
      token: feedback.token,
      inquiryId: feedback.inquiryId,
      coupleName: feedback.coupleName,
      eventName: event?.name || 'Ek Duje Ke Liye Seminar',
      eventDate: event?.date || '',
      isSubmitted: feedback.isSubmitted,
      overallRating: feedback.overallRating,
      contentRating: feedback.contentRating,
      speakerRating: feedback.speakerRating,
      venueRating: feedback.venueRating,
      wouldRecommend: feedback.wouldRecommend,
      feedbackText: feedback.feedbackText
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
  const { overallRating, contentRating, speakerRating, venueRating, wouldRecommend, feedbackText } = req.body;

  try {
    const feedback = await Feedback.findOne({ token });
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback form not found.' });
    }

    feedback.overallRating = Number(overallRating) || 5;
    feedback.contentRating = Number(contentRating) || 5;
    feedback.speakerRating = Number(speakerRating) || 5;
    feedback.venueRating = Number(venueRating) || 5;
    feedback.wouldRecommend = wouldRecommend !== false;
    feedback.feedbackText = String(feedbackText || '').trim();
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
