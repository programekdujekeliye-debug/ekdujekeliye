import crypto from 'crypto';
import {
  verifyCheckoutSignature,
  verifyWebhookSignature
} from './services/razorpay.js';

console.log('--- Starting Razorpay & Webhook Unit Tests ---');

// Test 1: Checkout HMAC-SHA256 Signature Verification
const TEST_KEY_SECRET = 'test_secret_key_12345';
process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

const order_id = 'order_EKTEST001';
const payment_id = 'pay_EKTEST001';
const expectedValidSignature = crypto
  .createHmac('sha256', TEST_KEY_SECRET)
  .update(`${order_id}|${payment_id}`)
  .digest('hex');

const isSigValid = verifyCheckoutSignature({
  razorpay_order_id: order_id,
  razorpay_payment_id: payment_id,
  razorpay_signature: expectedValidSignature
});

if (isSigValid) {
  console.log('✅ Test 1 Passed: Valid checkout signature returns true.');
} else {
  console.error('❌ Test 1 Failed: Valid checkout signature rejected.');
  process.exit(1);
}

// Test 2: Invalid Checkout Signature Rejection
const isInvalidSigRejected = !verifyCheckoutSignature({
  razorpay_order_id: order_id,
  razorpay_payment_id: payment_id,
  razorpay_signature: 'invalid_tampered_signature_hex'
});

if (isInvalidSigRejected) {
  console.log('✅ Test 2 Passed: Invalid/tampered checkout signature returns false.');
} else {
  console.error('❌ Test 2 Failed: Tampered checkout signature was falsely accepted.');
  process.exit(1);
}

// Test 3: Authoritative Webhook HMAC Signature Verification
const TEST_WEBHOOK_SECRET = 'whsec_test_secret_9988';
process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

const testPayload = JSON.stringify({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_998877',
        order_id: 'order_998877',
        amount: 149900,
        status: 'captured',
        notes: {
          inquiryId: 'EK01-01'
        }
      }
    }
  }
});
const rawBodyBuffer = Buffer.from(testPayload, 'utf8');

const validWebhookSignature = crypto
  .createHmac('sha256', TEST_WEBHOOK_SECRET)
  .update(rawBodyBuffer)
  .digest('hex');

const isWebhookValid = verifyWebhookSignature({
  rawBody: rawBodyBuffer,
  signature: validWebhookSignature
});

if (isWebhookValid) {
  console.log('✅ Test 3 Passed: Valid webhook signature validated successfully with raw body.');
} else {
  console.error('❌ Test 3 Failed: Valid webhook signature rejected.');
  process.exit(1);
}

// Test 4: Webhook Signature Tamper Check
const isTamperedWebhookRejected = !verifyWebhookSignature({
  rawBody: rawBodyBuffer,
  signature: 'tampered_webhook_signature'
});

if (isTamperedWebhookRejected) {
  console.log('✅ Test 4 Passed: Tampered webhook signature rejected.');
} else {
  console.error('❌ Test 4 Failed: Tampered webhook signature falsely accepted.');
  process.exit(1);
}

console.log('--- All Razorpay Unit Tests Passed Successfully ---');
