import crypto from 'crypto';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { eventService } from '../events/event.service.js';
import { Counter, getNextSequence } from '../../models/Counter.js';
import { storageService } from '../../services/storage.service.js';
import { mediaService } from '../media/media.service.js';
import { sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';

export class RegistrationService {
  /**
   * Submit a new Couple Registration
   */
  async createRegistration({ husbandName, wifeName, surname, phoneNumber, programId, couplePhotoFile, whatsappOptIn = true }) {
    // 1. Fetch Program & verify capacity
    const program = await eventService.getEventBySlug(programId) || await Event.findOne({ id: programId }).lean();
    if (!program) {
      const err = new Error('Invalid program/slot selected.');
      err.status = 400;
      throw err;
    }

    const activeCount = await Registration.countDocuments({
      programId,
      status: { $in: ['approved', 'pending'] },
      isDeleted: { $ne: true }
    });
    if ((activeCount * 2) + 2 > program.capacity) {
      const err = new Error('This program slot is completely full.');
      err.status = 400;
      throw err;
    }

    // 2. Per-event duplicate phone check
    const existingRegistration = await Registration.findOne({
      phoneNumber,
      programId,
      status: { $ne: 'rejected' },
      isDeleted: { $ne: true }
    });

    if (existingRegistration) {
      const err = new Error(`Already registered for this event date (${existingRegistration.inquiryId}).`);
      err.status = 400;
      err.alreadyRegistered = true;
      err.inquiryId = existingRegistration.inquiryId;
      err.statusType = existingRegistration.status;
      err.customerToken = existingRegistration.customerToken;
      throw err;
    }

    // 3. Generate Inquiry ID (EK<ProgramSeq>-<CounterSeq>)
    let inquiryId;
    if (program.sequenceNumber) {
      const seqPad = String(program.sequenceNumber).padStart(2, '0');
      const counterVal = await getNextSequence(`inquiryNumber_${program.id}`);
      const numPad = String(counterVal).padStart(2, '0');
      inquiryId = `EK${seqPad}-${numPad}`;
    } else {
      const counterVal = await getNextSequence('inquiryNumber');
      inquiryId = `CPL-${counterVal}`;
    }

    // 4. Upload photo to Cloudinary/Storage
    let couplePhotoUrl = '/sample_couple.png';
    if (couplePhotoFile && couplePhotoFile.buffer) {
      const base64Data = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
      couplePhotoUrl = await storageService.upload({
        data: base64Data,
        folder: 'couplePhotos',
        filename: `${inquiryId}_couple`
      });
    }

    // 5. Generate secure customer lookup token
    const customerToken = crypto.randomBytes(16).toString('hex');
    const amount = program.price !== undefined ? Number(program.price) : 1500;

    const newRegistration = new Registration({
      inquiryId,
      customerToken,
      husbandName,
      wifeName,
      surname,
      phoneNumber,
      whatsappOptIn: Boolean(whatsappOptIn),
      whatsappOptInAt: whatsappOptIn ? new Date() : null,
      whatsappConsentSource: whatsappOptIn ? 'registration_form' : '',
      whatsappMarketingOptIn: false,
      programId: program.id,
      programName: program.name,
      programDate: program.date,
      programTime: program.time || '8:30 PM',
      couplePhoto: couplePhotoUrl,
      status: 'pending',
      payment: {
        provider: 'razorpay',
        status: 'pending',
        amount,
        currency: 'INR'
      }
    });

    await newRegistration.save();

    // Dispatch Exactly ONE WhatsApp Message: Registration Received / Payment Pending
    try {
      const customerName = `${husbandName || ''} & ${wifeName || ''}`.trim() || 'Valued Couple';
      const eventName = program.name || 'Ek Duje Ke Liye Seminar';
      const eventDate = program.date || 'TBD';
      const eventTime = program.time || '8:30 PM';
      const venue = program.venue || 'Sardar Smruti Bhavan, Surat';
      const feeAmount = `₹${amount}`;

      await sendUtilityTemplate({
        recipientPhone: phoneNumber,
        templateKey: 'edkl_payment_pending_v1',
        languageCode: 'en_US',
        variables: {
          customerName,
          eventName,
          registrationId: inquiryId,
          eventDate,
          eventTime,
          venue,
          feeAmount,
          inquiryId
        },
        idempotencyKey: `REGISTRATION_PENDING:${newRegistration._id}:${inquiryId}`,
        registrationId: newRegistration._id,
        eventId: program.id,
        inquiryId,
        trigger: 'registration_created'
      });
    } catch (msgErr) {
      console.warn('[RegistrationService] WhatsApp M1 dispatch notice:', msgErr.message);
    }

    return {
      registration: newRegistration,
      inquiryId,
      customerToken,
      amount,
      programName: program.name
    };
  }

  /**
   * Get registration status by inquiry ID with central media resolution
   */
  async getStatus(inquiryId) {
    if (!inquiryId) return null;
    const formattedId = String(inquiryId).trim();
    const submission = await Registration.findOne({
      $or: [
        { inquiryId: formattedId },
        { inquiryId: formattedId.toUpperCase() }
      ],
      isDeleted: { $ne: true }
    }).lean();

    if (!submission) return null;

    const [program, mediaState] = await Promise.all([
      eventService.getEventBySlug(submission.programId),
      mediaService.resolveRegistrationMedia(submission)
    ]);

    return {
      ...submission,
      ...mediaState,
      program: program || null
    };
  }
}

export const registrationService = new RegistrationService();
