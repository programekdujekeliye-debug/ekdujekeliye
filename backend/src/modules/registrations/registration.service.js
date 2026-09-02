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
    const program = await eventService.getEventBySlug(programId) || await Event.findOne({
      $or: [{ id: programId }, { slug: programId }, { date: programId }]
    }).lean();
    if (!program) {
      const err = new Error('Invalid program/slot selected.');
      err.status = 400;
      throw err;
    }

    if (program.status === 'housefull' || program.status === 'registration_closed' || program.isRegistrationOpen === false) {
      const err = new Error('Registrations for this seminar date are currently full/closed (Housefull).');
      err.status = 400;
      throw err;
    }

    const progIdentifiers = [program.id, program.slug, program.date].filter(Boolean);
    const capacity = program.capacity && program.capacity > 0 ? program.capacity : 1184;

    const activeCount = await Registration.countDocuments({
      $or: [
        { programId: { $in: progIdentifiers } },
        ...(program.date ? [{ programDate: program.date }] : [])
      ],
      status: { $in: ['approved', 'pending'] },
      isDeleted: { $ne: true }
    });

    if (activeCount >= capacity) {
      const err = new Error('Housefull: This program slot has reached maximum seating capacity.');
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

    // 3. Generate Guaranteed Unique Inquiry ID
    const generateUniqueInquiryId = async () => {
      const seqPad = String(program.sequenceNumber || 1).padStart(2, '0');
      const counterKey = program.sequenceNumber ? `inquiryNumber_${program.id}` : 'inquiryNumber';

      for (let attempt = 0; attempt < 50; attempt++) {
        const counterVal = await getNextSequence(counterKey);
        const candidateId = program.sequenceNumber
          ? `EK${seqPad}-${String(counterVal).padStart(2, '0')}`
          : `CPL-${counterVal}`;

        const exists = await Registration.findOne({ inquiryId: candidateId }).select('_id').lean();
        if (!exists) {
          return candidateId;
        }
      }

      // High entropy fallback
      const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
      return `EK${seqPad}-${rand}`;
    };

    let inquiryId = await generateUniqueInquiryId();

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

    // Save with duplicate key retry protection
    let saved = false;
    let retries = 0;
    while (!saved && retries < 5) {
      try {
        await newRegistration.save();
        saved = true;
      } catch (saveErr) {
        if (saveErr.code === 11000 && String(saveErr.message).includes('inquiryId')) {
          retries++;
          inquiryId = await generateUniqueInquiryId();
          newRegistration.inquiryId = inquiryId;
          continue;
        }
        throw saveErr;
      }
    }

    const isEarlyRegistration = Boolean(program.isPaymentEnabled === false || program.earlyRegistrationMode === true || program.communicationsEnabled === false);

    const customerName = `${husbandName || ''} & ${wifeName || ''}`.trim() || 'Valued Couple';
    const eventName = program.name || 'Ek Duje Ke Liye Seminar';
    const eventDate = program.date || 'TBD';
    const eventTime = program.time || '8:30 PM';
    const venue = program.venue || 'Sardar Smruti Bhavan, Surat';
    const feeAmount = `₹${amount}`;

    if (isEarlyRegistration) {
      // Early Registration: Send Registration Received Acknowledgment (Payment not open yet)
      try {
        await sendUtilityTemplate({
          recipientPhone: phoneNumber,
          templateKey: 'edkl_registration_received_v1',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName,
            registrationId: inquiryId,
            eventDate,
            eventTime,
            venue,
            statusText: 'Early Registration Received'
          },
          idempotencyKey: `REGISTRATION_RECEIVED:${newRegistration._id}:${inquiryId}`,
          registrationId: newRegistration._id,
          eventId: program.id,
          inquiryId,
          trigger: 'early_registration_created'
        });
      } catch (msgErr) {
        console.warn('[RegistrationService] Early registration WhatsApp dispatch notice:', msgErr.message);
      }
    } else {
      // Standard Registration with Active Online Payment & Communications: Send payment link button (Async Non-Blocking)
      try {
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
        console.warn('[RegistrationService] Background WhatsApp dispatch notice:', msgErr.message);
      }
    }


    return {
      registration: newRegistration,
      inquiryId,
      customerToken,
      amount,
      programName: program.name,
      earlyRegistration: isEarlyRegistration,
      isPaymentEnabled: !isEarlyRegistration
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

    let program = null;
    if (submission.programId) {
      program = await eventService.getEventBySlug(submission.programId);
    }
    if (!program && submission.programDate) {
      program = await Event.findOne({ date: submission.programDate }).lean();
    }
    if (!program && submission.inquiryId) {
      const inq = submission.inquiryId.toUpperCase();
      if (inq.startsWith('EK06') || inq.startsWith('EK-06') || inq.startsWith('EK 06')) {
        program = await Event.findOne({
          $or: [{ id: 'prog-2026-09-07' }, { date: '2026-09-07' }, { slug: 'surat-7-september-2026' }]
        }).lean();
      } else if (inq.startsWith('EK07') || inq.startsWith('EK-07') || inq.startsWith('EK 07')) {
        program = await Event.findOne({
          $or: [{ id: 'prog-2026-09-11' }, { date: '2026-09-11' }, { slug: 'surat-11-september-2026' }]
        }).lean();
      }
    }

    const mediaState = await mediaService.resolveRegistrationMedia(submission);
    const resolvedTemplate = program?.cardTemplateUrl || program?.cardTemplate || submission.cardTemplate || null;

    return {
      ...submission,
      ...mediaState,
      cardTemplate: resolvedTemplate,
      program: program ? {
        ...program,
        cardTemplate: resolvedTemplate,
        cardTemplateUrl: resolvedTemplate
      } : null
    };
  }
}

export const registrationService = new RegistrationService();
