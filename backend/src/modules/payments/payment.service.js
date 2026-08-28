import { razorpayService } from '../../integrations/razorpay/razorpay.service.js';
import { Registration } from '../../models/Registration.js';
import { Payment } from '../../models/Payment.js';
import { WebhookEvent } from '../../models/WebhookEvent.js';
import { eventService } from '../events/event.service.js';
import { qrPassService } from '../passes/qrPass.service.js';
import { sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';
import { communicationSchedulerService } from '../../services/communicationScheduler.service.js';

export class PaymentService {
  /**
   * Create Razorpay Standard Checkout Order
   */
  async createCheckoutOrder({ inquiryId, customerToken }) {
    const submission = await Registration.findOne({
      $or: [
        { inquiryId: inquiryId?.trim() },
        { customerToken: customerToken?.trim() }
      ]
    });

    if (!submission) {
      throw new Error('Registration record not found.');
    }

    if (submission.payment?.status === 'captured' || submission.status === 'approved') {
      return {
        alreadyPaid: true,
        inquiryId: submission.inquiryId,
        message: 'Registration is already paid and confirmed.'
      };
    }

    const event = await eventService.getEventBySlug(submission.programId);
    const amountInr = event?.price || submission.payment?.amount || 1500;

    const receipt = `RCPT_${submission.inquiryId}_${Date.now()}`.substring(0, 40);
    const notes = {
      inquiryId: submission.inquiryId,
      programId: submission.programId || '',
      programName: (event?.name || submission.programName || 'Ek Duje Ke Liye').substring(0, 40)
    };

    const order = await razorpayService.createOrder({
      amountInr,
      currency: 'INR',
      receipt,
      notes
    });

    submission.payment.razorpayOrderId = order.id;
    submission.payment.amount = amountInr;
    submission.payment.status = 'pending';
    submission.payment.attempts = (submission.payment.attempts || 0) + 1;
    await submission.save();

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayService.keyId,
      inquiryId: submission.inquiryId,
      coupleName: `${submission.husbandName || ''} & ${submission.wifeName || ''}`.trim(),
      phoneNumber: submission.phoneNumber,
      programName: event?.name || submission.programName
    };
  }

  /**
   * Create Razorpay Order (Alias for createCheckoutOrder)
   */
  async createOrder({ inquiryId, customerToken }) {
    return this.createCheckoutOrder({ inquiryId, customerToken });
  }

  /**
   * Verify Payment (Alias for verifyPaymentSignature)
   */
  async verifyPayment(params) {
    return this.verifyPaymentSignature(params);
  }

  /**
   * Verify and Authorize Payment from Frontend Signature
   */
  async verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    inquiryId
  }) {
    const orderId = razorpayOrderId || razorpay_order_id;
    const paymentId = razorpayPaymentId || razorpay_payment_id;
    const signature = razorpaySignature || razorpay_signature;

    const isValid = razorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature
    });

    if (!isValid) {
      throw new Error('Invalid Razorpay cryptographic payment signature.');
    }

    const query = orderId
      ? { $or: [{ 'payment.razorpayOrderId': orderId }, { inquiryId: inquiryId?.trim() }] }
      : { inquiryId: inquiryId?.trim() };

    const submission = await Registration.findOne(query);

    if (!submission) {
      throw new Error(`Registration not found for order ${orderId || inquiryId}`);
    }

    submission.status = 'approved';
    submission.payment.status = 'captured';
    submission.payment.razorpayPaymentId = razorpayPaymentId;
    submission.payment.razorpaySignature = razorpaySignature;
    submission.payment.paidAt = new Date();
    await submission.save();

    // Record verified transaction in ledger
    try {
      await Payment.findOneAndUpdate(
        { paymentId: razorpayPaymentId },
        {
          paymentId: razorpayPaymentId,
          orderId: razorpayOrderId,
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

    // 1. Authoritative Ensure Digital Pass with Asymmetric Ed25519 Signatures
    try {
      const event = await eventService.getEventBySlug(submission.programId);
      const pass = await qrPassService.ensurePass(submission, event);

      const customerName = `${submission.husbandName || ''} & ${submission.wifeName || ''}`.trim() || 'Guest';
      const eventName = event?.name || submission.programName || 'Ek Duje Ke Liye Seminar';
      const eventDate = event?.date || submission.programDate || '';
      const eventTime = event?.time || submission.programTime || '8:30 PM';
      const venue = event?.venue || 'Sardar Smruti Bhavan, Surat';

      // Dispatch M3: Payment Confirmation & Digital Pass
      await sendUtilityTemplate({
        recipientPhone: submission.phoneNumber,
        templateKey: 'edkl_payment_confirmed_pass_v1',
        languageCode: 'en_US',
        variables: {
          customerName,
          eventName,
          eventDate,
          eventTime,
          venue,
          registrationId: submission.inquiryId,
          inquiryId: submission.inquiryId
        },
        idempotencyKey: `PAYMENT_CONFIRMED:${submission._id}:${razorpayPaymentId}`,
        registrationId: submission._id,
        eventId: submission.programId,
        inquiryId: submission.inquiryId,
        trigger: 'payment_verified'
      });

      // Schedule Future Lifecycle: 48h Invitation, 24h Reminder, Post-Event Feedback
      await communicationSchedulerService.scheduleRegistrationLifecycle(submission, event);
    } catch (err) {
      console.error('[PaymentService] Error ensuring pass/whatsapp on verify:', err);
    }

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

      // Authoritative Captured Finalization: Ensure Pass & Queue WhatsApp Confirmation
      try {
        const event = await eventService.getEventBySlug(submission.programId);
        const pass = await qrPassService.ensurePass(submission, event);

        const customerName = `${submission.husbandName || ''} & ${submission.wifeName || ''}`.trim() || 'Guest';
        const eventName = event?.name || submission.programName || 'Ek Duje Ke Liye Seminar';
        const eventDate = event?.date || submission.programDate || '';
        const eventTime = event?.time || submission.programTime || '8:30 PM';
        const venue = event?.venue || 'Sardar Smruti Bhavan, Surat';

        // Dispatch M3: Payment Confirmation
        await sendUtilityTemplate({
          recipientPhone: submission.phoneNumber,
          templateKey: 'edkl_payment_confirmed_pass_v1',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName,
            eventDate,
            eventTime,
            venue,
            registrationId: submission.inquiryId,
            inquiryId: submission.inquiryId
          },
          idempotencyKey: `PAYMENT_CONFIRMED:${submission._id}:${paymentId}`,
          registrationId: submission._id,
          eventId: submission.programId,
          inquiryId: submission.inquiryId,
          trigger: 'payment_webhook_captured'
        });

        // Dispatch M4: Digital Pass Ready
        await sendUtilityTemplate({
          recipientPhone: submission.phoneNumber,
          templateKey: 'edkl_event_reminder_v1',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName,
            eventDate,
            eventTime,
            venue,
            registrationId: submission.inquiryId,
            inquiryId: submission.inquiryId
          },
          idempotencyKey: `PASS_READY:${pass.passId}:v${pass.version || 1}`,
          registrationId: submission._id,
          eventId: submission.programId,
          inquiryId: submission.inquiryId,
          trigger: 'pass_issued'
        });

        // Schedule Future Lifecycle: 48h Invitation, 24h Reminder, Post-Event Feedback
        await communicationSchedulerService.scheduleRegistrationLifecycle(submission, event);
      } catch (err) {
        console.error('[PaymentService] Error ensuring pass/whatsapp on webhook:', err);
      }
    }

    return { status: 'captured', inquiryId: submission?.inquiryId };
  }
}

export const paymentService = new PaymentService();
