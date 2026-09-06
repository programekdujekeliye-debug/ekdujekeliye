import { razorpayService } from '../../integrations/razorpay/razorpay.service.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { Payment } from '../../models/Payment.js';
import { WebhookEvent } from '../../models/WebhookEvent.js';
import { WhatsappMessage } from '../../models/WhatsappMessage.js';
import { eventService } from '../events/event.service.js';
import { qrPassService } from '../passes/qrPass.service.js';
import { sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';
import { communicationSchedulerService } from '../../services/communicationScheduler.service.js';

export class PaymentService {
  /**
   * Create Razorpay Standard Checkout Order
   */
  async createCheckoutOrder({ inquiryId, customerToken } = {}) {
    const query = [];
    if (inquiryId && typeof inquiryId === 'string' && inquiryId.trim()) {
      query.push({ inquiryId: inquiryId.trim() });
    }
    if (customerToken && typeof customerToken === 'string' && customerToken.trim()) {
      query.push({ customerToken: customerToken.trim() });
    }

    if (query.length === 0) {
      throw new Error('Inquiry ID or Customer Token is required.');
    }

    const submission = await Registration.findOne({ $or: query });

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

    const event = await Event.findOne({
      $or: [
        { id: submission.programId },
        { slug: submission.programId },
        { date: submission.programDate }
      ]
    }).lean() || await eventService.getEventBySlug(submission.programId);
    
    // Guard: Temporary Early Registration Mode (Payment Disabled at Event Level)
    if (event && (event.isPaymentEnabled === false || event.earlyRegistrationMode === true)) {
      const err = new Error('PAYMENT_NOT_OPEN');
      err.status = 400;
      err.code = 'PAYMENT_NOT_OPEN';
      err.message = 'Online payment for this event is not open yet. Registration is recorded, and you will receive a payment link on WhatsApp when payment opens.';
      throw err;
    }

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
    submission.payment.razorpayPaymentId = paymentId;
    submission.payment.razorpayOrderId = orderId;
    submission.payment.razorpaySignature = signature;
    submission.payment.paidAt = new Date();
    // Guarantee that newly paid attendee always starts in unprinted queue so their physical frame is printed
    submission.frameExportStatus = 'NOT_EXPORTED';
    submission.frameExportedAt = null;
    await submission.save();

    // Record verified transaction in ledger
    try {
      await Payment.findOneAndUpdate(
        { paymentId },
        {
          paymentId,
          orderId,
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

    // Cancel all pending/queued payment reminder messages for this registration
    try {
      await WhatsappMessage.updateMany(
        {
          registrationId: submission._id,
          messageType: 'payment_pending',
          status: 'QUEUED'
        },
        {
          $set: {
            status: 'CANCELLED',
            lastErrorMessage: 'Payment captured successfully. Payment reminders cancelled.'
          }
        }
      );
    } catch (e) {
      console.warn('[PaymentService] Error cancelling pending payment reminders:', e.message);
    }

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
        idempotencyKey: `PAYMENT_CONFIRMED:${submission._id}:${paymentId}`,
        registrationId: submission._id,
        eventId: submission.programId,
        inquiryId: submission.inquiryId,
        trigger: 'payment_verified'
      });

      // Cancel any pending payment reminders in queue
      await WhatsappMessage.updateMany(
        {
          inquiryId: submission.inquiryId,
          messageType: 'payment_pending',
          status: 'QUEUED'
        },
        {
          $set: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'PAYMENT_CAPTURED'
          }
        }
      );

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
      // Guarantee that newly paid attendee always starts in unprinted queue so their physical frame is printed
      submission.frameExportStatus = 'NOT_EXPORTED';
      submission.frameExportedAt = null;
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

      // Cancel all pending/queued payment reminder messages for this registration
      try {
        await WhatsappMessage.updateMany(
          {
            registrationId: submission._id,
            messageType: 'payment_pending',
            status: { $in: ['QUEUED', 'SENDING'] }
          },
          {
            $set: {
              status: 'CANCELLED',
              lastErrorMessage: 'Payment captured successfully. Payment reminders cancelled.'
            }
          }
        );
      } catch (e) {
        console.warn('[PaymentService] Error cancelling pending payment reminders on webhook:', e.message);
      }

      // Authoritative Captured Finalization: Ensure Pass & Queue WhatsApp Confirmation
      try {
        const event = await eventService.getEventBySlug(submission.programId);
        const pass = await qrPassService.ensurePass(submission, event);

        const customerName = `${submission.husbandName || ''} & ${submission.wifeName || ''}`.trim() || 'Guest';
        const eventName = event?.name || submission.programName || 'Ek Duje Ke Liye Seminar';
        const eventDate = event?.date || submission.programDate || '';
        const eventTime = event?.time || submission.programTime || '8:30 PM';
        const venue = event?.venue || 'Sardar Smruti Bhavan, Surat';

        // Dispatch M3: Payment Confirmation & Pass
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

        // Cancel any pending payment reminders in queue
        await WhatsappMessage.updateMany(
          {
            inquiryId: submission.inquiryId,
            messageType: 'payment_pending',
            status: 'QUEUED'
          },
          {
            $set: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancellationReason: 'PAYMENT_CAPTURED'
            }
          }
        );

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
