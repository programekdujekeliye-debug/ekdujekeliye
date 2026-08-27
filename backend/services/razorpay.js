import Razorpay from 'razorpay';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) {}

/**
 * Razorpay Payment Service
 * 
 * Encapsulates Razorpay SDK interaction, order creation, checkout signature verification,
 * and webhook HMAC-SHA256 signature verification.
 */

// Helper to get initialized Razorpay instance
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured in environment.');
  }

  return new Razorpay({ key_id, key_secret });
};

/**
 * Safely retrieve public Key ID for client checkout initialization
 */
export const getRazorpayKeyId = () => {
  return process.env.RAZORPAY_KEY_ID || '';
};

/**
 * Create a new Razorpay Order for a registration
 * @param {Object} params
 * @param {string} params.inquiryId - Registration Inquiry ID (used as receipt identifier)
 * @param {number} params.amount - Price in INR (will be converted to paise)
 * @param {string} [params.currency='INR']
 * @param {Object} [params.notes={}]
 * @returns {Promise<Object>} Razorpay Order details
 */
export const createRazorpayOrder = async ({ inquiryId, amount, currency = 'INR', notes = {} }) => {
  const instance = getRazorpayInstance();
  const amountInPaise = Math.round(Number(amount) * 100);

  if (isNaN(amountInPaise) || amountInPaise <= 0) {
    throw new Error(`Invalid order amount: ${amount}`);
  }

  const options = {
    amount: amountInPaise,
    currency,
    receipt: String(inquiryId).slice(0, 40), // Razorpay receipt max length is 40 chars
    notes: {
      inquiryId: String(inquiryId),
      ...notes
    }
  };

  const order = await instance.orders.create(options);
  return order;
};

/**
 * Verify checkout response signature returned by the browser after successful payment
 * @param {Object} params
 * @param {string} params.razorpay_order_id
 * @param {string} params.razorpay_payment_id
 * @param {string} params.razorpay_signature
 * @returns {boolean}
 */
export const verifyCheckoutSignature = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error('[Razorpay Service] RAZORPAY_KEY_SECRET is not configured.');
    return false;
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(razorpay_signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error('[Razorpay Service] Error verifying signature buffer:', err);
    return expectedSignature === razorpay_signature;
  }
};

/**
 * Verify authoritative Razorpay Webhook signature
 * @param {Object} params
 * @param {Buffer|string} params.rawBody - Raw unparsed request body buffer
 * @param {string} params.signature - X-Razorpay-Signature header value
 * @returns {boolean}
 */
export const verifyWebhookSignature = ({ rawBody, signature }) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Razorpay Service] RAZORPAY_WEBHOOK_SECRET is not configured.');
    return false;
  }

  if (!rawBody || !signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error('[Razorpay Service] Webhook signature verification error:', err);
    return false;
  }
};

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId
 * @returns {Promise<Object>}
 */
export const fetchPayment = async (paymentId) => {
  const instance = getRazorpayInstance();
  return await instance.payments.fetch(paymentId);
};

/**
 * Fetch order details from Razorpay
 * @param {string} orderId
 * @returns {Promise<Object>}
 */
export const fetchOrder = async (orderId) => {
  const instance = getRazorpayInstance();
  return await instance.orders.fetch(orderId);
};
