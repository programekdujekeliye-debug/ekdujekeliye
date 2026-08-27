import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.');
  }
  return new Razorpay({
    key_id,
    key_secret
  });
};

export const getRazorpayKeyId = () => {
  return process.env.RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID || '';
};

export const createRazorpayOrder = async ({ inquiryId, amount, currency = 'INR', notes = {} }) => {
  const instance = getRazorpayInstance();
  const amountInPaise = Math.round(Number(amount) * 100);

  if (isNaN(amountInPaise) || amountInPaise <= 0) {
    throw new Error(`Invalid order amount: ${amount}`);
  }

  const options = {
    amount: amountInPaise,
    currency,
    receipt: String(inquiryId).slice(0, 40),
    notes: {
      inquiryId: String(inquiryId),
      ...notes
    }
  };

  return await instance.orders.create(options);
};

export const verifyCheckoutSignature = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;
  if (!secret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(razorpay_signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error('[Razorpay Service] Buffer verification error:', err);
    return expectedSignature === razorpay_signature;
  }
};

export const verifyWebhookSignature = ({ rawBody, signature }) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !rawBody || !signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error('[Razorpay Service] Webhook buffer verification error:', err);
    return false;
  }
};

export const fetchPayment = async (paymentId) => {
  const instance = getRazorpayInstance();
  return await instance.payments.fetch(paymentId);
};

export const fetchOrder = async (orderId) => {
  const instance = getRazorpayInstance();
  return await instance.orders.fetch(orderId);
};
