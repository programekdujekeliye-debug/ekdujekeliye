import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { Payment } from '../../models/Payment.js';
import { WebhookEvent } from '../../models/WebhookEvent.js';
import {
  createRazorpayOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature
} from '../../integrations/razorpay/razorpay.service.js';

export class PaymentService {
  /**
   * Create Razorpay Order for an inquiry
   */
  async createOrder({ inquiryId }) {
    const submission = await Registration.findOne({ inquiryId, isDeleted: { $ne: true } });
    if (!submission) {
      const err = new Error('Registration inquiry not found.');
      err.status = 404;
      throw err;
    }

    const program = await Event.findOne({ id: submission.programId });
    if (!program) {
      const err = new Error('Program not found.');
      err.status = 404;
      throw err;
    }

    const price = program.price !== undefined ? Number(program.price) : 1500;

    const order = await createRazorpayOrder({
      inquiryId: submission.inquiryId,
      amount: price,
      currency: 'INR',
      notes: {
        husbandName: submission.husbandName,
        wifeName: submission.wifeName,
        phoneNumber: submission.phoneNumber,
        programName: program.name
      }
    });

    submission.payment = {
      provider: 'razorpay',
      status: 'created',
      amount: price,
      currency: 'INR',
      razorpayOrderId: order.id,
      attempts: (submission.payment?.attempts || 0) + 1,
      createdAt: new Date()
    };
    await submission.save();

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      inquiryId: submission.inquiryId,
      programName: program.name,
      husbandName: submission.husbandName,
      wifeName: submission.wifeName,
      phoneNumber: submission.phoneNumber
    };
  }

  /**
   * Verify Checkout Signature
   */
  async verifyPayment({ inquiryId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    const isValid = verifyCheckoutSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValid) {
      const err = new Error('Payment signature verification failed.');
      err.status = 400;
      throw err;
    }

    const submission = await Registration.findOne({ inquiryId });
    if (!submission) {
      const err = new Error('Registration not found.');
      err.status = 404;
      throw err;
    }

    submission.status = 'approved';
    submission.payment.status = 'captured';
    submission.payment.razorpayPaymentId = razorpay_payment_id;
    submission.payment.razorpayOrderId = razorpay_order_id;
    submission.payment.razorpaySignature = razorpay_signature;
    submission.payment.paidAt = new Date();
    await submission.save();

    // Create payment ledger entry
    try {
      await Payment.findOneAndUpdate(
        { paymentId: razorpay_payment_id },
        {
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          inquiryId: submission.inquiryId,
          eventId: submission.programId,
          amount: submission.payment.amount || 1500,
          currency: 'INR',
          status: 'captured',
          provider: 'razorpay',
          capturedAt: new Date()
        },
        { upsert: true }
      );
    } catch (e) {}

    return submission;
  }

  /**
   * Finalize Captured Payment from Razorpay Webhook
   */
  async finalizeWebhookPayment({ eventId, orderId, paymentId, amount, inquiryId, rawPayload }) {
    // Idempotency check
    const existing = await WebhookEvent.findOne({ provider: 'razorpay', eventId });
    if (existing) {
      return { status: 'already_processed' };
    }

    await WebhookEvent.create({
      provider: 'razorpay',
      eventId,
      eventType: 'payment.captured',
      payloadSummary: { orderId, paymentId, inquiryId, amount }
    });

    const submission = await Registration.findOne({
      $or: [
        { inquiryId },
        { 'payment.razorpayOrderId': orderId }
      ]
    });

    if (submission) {
      submission.status = 'approved';
      submission.payment.status = 'captured';
      submission.payment.razorpayPaymentId = paymentId;
      submission.payment.paidAt = new Date();
      await submission.save();

      try {
        await Payment.findOneAndUpdate(
          { paymentId },
          {
            paymentId,
            orderId,
            inquiryId: submission.inquiryId,
            eventId: submission.programId,
            amount: amount ? amount / 100 : (submission.payment.amount || 1500),
            currency: 'INR',
            status: 'captured',
            provider: 'razorpay',
            rawResponse: rawPayload,
            capturedAt: new Date()
          },
          { upsert: true }
        );
      } catch (e) {}
    }

    return { status: 'captured', inquiryId: submission?.inquiryId };
  }
}

export const paymentService = new PaymentService();
