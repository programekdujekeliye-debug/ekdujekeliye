import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema({
  inquiryId: { type: String, required: true, index: true },
  eventId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  coupleName: { type: String, default: '' },
  overallRating: { type: Number, min: 1, max: 5, default: 5 },
  contentRating: { type: Number, min: 1, max: 5, default: 5 },
  speakerRating: { type: Number, min: 1, max: 5, default: 5 },
  venueRating: { type: Number, min: 1, max: 5, default: 5 },
  wouldRecommend: { type: Boolean, default: true },
  feedbackText: { type: String, default: '' },
  keyTakeaways: { type: [String], default: [] },
  connectionRating: { type: String, default: 'MUCH_CLOSER' },
  isTestimonialAllowed: { type: Boolean, default: false },
  isSubmitted: { type: Boolean, default: false },
  submittedAt: { type: Date, default: null }
}, {
  collection: 'event_feedbacks',
  timestamps: true,
  autoIndex: false
});

FeedbackSchema.index({ inquiryId: 1, eventId: 1 }, { unique: true });
FeedbackSchema.index({ token: 1 }, { unique: true });

export const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);
