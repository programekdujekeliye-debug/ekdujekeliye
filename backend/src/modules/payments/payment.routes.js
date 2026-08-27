import { Router } from 'express';
import {
  createOrder,
  verifyPayment,
  handleRazorpayWebhook,
  getPaymentStatus
} from './payment.controller.js';

export const paymentRouter = Router();

paymentRouter.post('/create-order', createOrder);
paymentRouter.post('/verify', verifyPayment);
paymentRouter.post('/webhook', handleRazorpayWebhook);
paymentRouter.get('/status/:inquiryId', getPaymentStatus);
