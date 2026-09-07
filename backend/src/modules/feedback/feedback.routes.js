import { Router } from 'express';
import {
  getFeedbackForm,
  submitFeedback,
  getAdminFeedbackStats,
  getAdminFeedbackList,
  toggleTestimonialPermission,
  deleteFeedbackRecord,
  exportFeedbackData,
  getPublicTestimonials,
  resetFeedbackSubmission
} from './feedback.controller.js';
import { requireAuth, requireSuperAuth } from '../../middleware/auth.js';

export const feedbackRouter = Router();

// Public verified testimonials for website showcase
feedbackRouter.get('/public/testimonials', getPublicTestimonials);

// Admin & Super Admin feedback management (Must precede /:token)
feedbackRouter.get('/admin/stats', requireAuth, getAdminFeedbackStats);
feedbackRouter.get('/admin/list', requireAuth, getAdminFeedbackList);
feedbackRouter.get('/admin/export', requireAuth, exportFeedbackData);
feedbackRouter.post('/admin/:id/toggle-testimonial', requireAuth, toggleTestimonialPermission);
feedbackRouter.post('/admin/:id/reset', requireAuth, resetFeedbackSubmission);
feedbackRouter.delete('/admin/:id', requireSuperAuth, deleteFeedbackRecord);

// Public couple feedback form retrieval & submission
feedbackRouter.get('/:token', getFeedbackForm);
feedbackRouter.post('/:token', submitFeedback);
feedbackRouter.post('/:token/reset', resetFeedbackSubmission);
