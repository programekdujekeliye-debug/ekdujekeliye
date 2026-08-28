import { Router } from 'express';
import { getFeedbackForm, submitFeedback } from './feedback.controller.js';

export const feedbackRouter = Router();

feedbackRouter.get('/:token', getFeedbackForm);
feedbackRouter.post('/:token', submitFeedback);
