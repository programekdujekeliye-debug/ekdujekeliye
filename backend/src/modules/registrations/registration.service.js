import crypto from 'crypto';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { eventService } from '../events/event.service.js';
import { Counter, getNextSequence } from '../../models/Counter.js';
import { storageService } from '../../services/storage.service.js';
import { mediaService } from '../media/media.service.js';
import { sendUtilityTemplate } from '../../integrations/whatsapp/whatsapp.service.js';
import { communicationSchedulerService } from '../../services/communicationScheduler.service.js';

const registrationLocks = new Set();

export class RegistrationService {
  /**
   * Submit a new Couple Registration
   */
  async createRegistration({ husbandName, wifeName, surname, phoneNumber, programId, couplePhotoFile, whatsappOptIn = true }, options = {}) {
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

    // Cutoff Guard: Close public registration once event has started
    if (program.date && program.date.toUpperCase() !== 'TBD') {
      const eventStartAt = communicationSchedulerService.parseEventDateTime(program.date, program.time || '8:30 PM');
      const now = (options && options.simulatedNow) ? new Date(options.simulatedNow) : new Date();
      if (eventStartAt && now >= eventStartAt) {
        const err = new Error('Registration closed. This event has already started or concluded.');
        err.status = 400;
        err.code = 'EVENT_STARTED';
        throw err;
      }
    }

    // Normalize phone number to clean 10-digit format
    const rawPhone = String(phoneNumber || '').trim();
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      const err = new Error('કૃપા કરીને સાચો 10-આંકડાનો મોબાઇલ નંબર દાખલ કરો! (Please enter a valid 10-digit mobile number)');
      err.status = 400;
      throw err;
    }

    // In-flight concurrency lock to prevent double-click duplicate creation
    const lockKey = `${cleanPhone}_${program.id}`;
    if (registrationLocks.has(lockKey)) {
      const err = new Error('Registration is currently being processed. Please wait a moment.');
      err.status = 429;
      throw err;
    }
    registrationLocks.add(lockKey);

    try {
      const progIdentifiers = [program.id, program.slug, program.date].filter(Boolean);
      const capacity = program.capacity && program.capacity > 0 ? program.capacity : 1184;

      const eventFilter = {
        $or: [
          { programId: { $in: progIdentifiers } },
          ...(program.date ? [{ programDate: program.date }] : [])
        ]
      };

      const activeCount = await Registration.countDocuments({
        ...eventFilter,
        status: { $in: ['approved', 'pending'] },
        isDeleted: { $ne: true }
      });

      if (activeCount >= capacity) {
        const err = new Error('Housefull: This program slot has reached maximum seating capacity.');
        err.status = 400;
        throw err;
      }

      // 2. Strict Per-event duplicate phone check (1 mobile = 1 entry)
      const phoneFilter = {
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `91${cleanPhone}` },
          { phoneNumber: `+91${cleanPhone}` }
        ]
      };

      const existingRegistration = await Registration.findOne({
        $and: [
          phoneFilter,
          eventFilter
        ],
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

      // 3. Same Couple Duplicate Protection (Same husband + wife + surname on same event)
      const hNameTrimmed = String(husbandName || '').trim();
      const wNameTrimmed = String(wifeName || '').trim();
      const sNameTrimmed = String(surname || '').trim();

      if (hNameTrimmed && wNameTrimmed && sNameTrimmed) {
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existingByCouple = await Registration.findOne({
          husbandName: { $regex: new RegExp(`^${escapeRegExp(hNameTrimmed)}$`, 'i') },
          wifeName: { $regex: new RegExp(`^${escapeRegExp(wNameTrimmed)}$`, 'i') },
          surname: { $regex: new RegExp(`^${escapeRegExp(sNameTrimmed)}$`, 'i') },
          ...eventFilter,
          status: { $ne: 'rejected' },
          isDeleted: { $ne: true }
        });

        if (existingByCouple) {
          // If already approved/paid: completely block re-registering
          if (existingByCouple.status === 'approved') {
            const err = new Error(`This couple (${hNameTrimmed} & ${wNameTrimmed} ${sNameTrimmed}) is already registered with a confirmed pass (${existingByCouple.inquiryId}).`);
            err.status = 400;
            err.alreadyRegistered = true;
            err.inquiryId = existingByCouple.inquiryId;
            err.statusType = existingByCouple.status;
            err.customerToken = existingByCouple.customerToken;
            throw err;
          }

          // If pending/unpaid (e.g., user made a typo in mobile and resubmitted 2 minutes later like Kamlesh):
          // Automatically update the mobile on the existing inquiry rather than creating a duplicate entry!
          if (existingByCouple.status === 'pending' || existingByCouple.status === 'inquiry') {
            existingByCouple.phoneNumber = cleanPhone;
            if (couplePhotoFile && couplePhotoFile.buffer) {
              const base64Data = `data:${couplePhotoFile.mimetype};base64,${couplePhotoFile.buffer.toString('base64')}`;
              existingByCouple.couplePhoto = await storageService.upload({
                data: base64Data,
                folder: 'couplePhotos',
                filename: `${existingByCouple.inquiryId}_couple`
              });
            }
            await existingByCouple.save();

            const isEarlyRegistration = Boolean(program.isPaymentEnabled === false || program.earlyRegistrationMode === true || program.communicationsEnabled === false);

            return {
              registration: existingByCouple,
              inquiryId: existingByCouple.inquiryId,
              customerToken: existingByCouple.customerToken,
              amount: existingByCouple.payment?.amount || (program.price !== undefined ? Number(program.price) : 1500),
              programName: program.name,
              earlyRegistration: isEarlyRegistration,
              isPaymentEnabled: !isEarlyRegistration
            };
          }
        }
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
      phoneNumber: cleanPhone,
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
          recipientPhone: cleanPhone,
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
      // Standard Registration with Active Online Payment:
      // Attendee is directed straight to Razorpay online payment on website.
      // Zero immediate WhatsApp noise while user is in active checkout.
      // If customer leaves unpaid, automated 10-minute polite reminder will handle it gracefully.
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
    } finally {
      registrationLocks.delete(lockKey);
    }
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
        { inquiryId: formattedId.toUpperCase() },
        { previousInquiryId: formattedId },
        { previousInquiryId: formattedId.toUpperCase() }
      ],
      isDeleted: { $ne: true }
    }).lean();

    if (!submission) return null;

    let program = null;

    // 1. Dynamic lookup by programId / slug
    if (submission.programId) {
      program = await eventService.getEventBySlug(submission.programId);
    }

    // 2. Direct lookup by programDate if date is valid
    if (!program && submission.programDate && submission.programDate !== 'TBD' && submission.programDate !== 'TBA') {
      program = await Event.findOne({ date: submission.programDate }).lean();
    }

    // 3. Dynamic lookup by sequence prefix (e.g. EK06-xx -> sequenceNumber: 6)
    if (!program && submission.inquiryId) {
      const match = String(submission.inquiryId).toUpperCase().match(/^EK(\d{1,2})-/);
      if (match) {
        const seqNum = parseInt(match[1], 10);
        program = await Event.findOne({ sequenceNumber: seqNum }).lean();
      }
    }

    // 4. Fallback lookup by ID with stripped suffixes
    if (!program && submission.programId) {
      program = await Event.findOne({
        $or: [
          { id: submission.programId },
          { id: submission.programId.replace(/-\d+$/, '') },
          { slug: submission.programId }
        ]
      }).lean();
    }

    // 5. Fresh DB lookup: If program was resolved but cardTemplate is null/empty, fetch fresh template from DB
    if (!program?.cardTemplate && !program?.cardTemplateUrl) {
      const searchConditions = [];
      if (submission.programId) searchConditions.push({ id: submission.programId });
      if (submission.programDate && submission.programDate !== 'TBD') searchConditions.push({ date: submission.programDate });
      if (program?.id) searchConditions.push({ id: program.id });
      if (program?.date) searchConditions.push({ date: program.date });

      if (searchConditions.length > 0) {
        const freshEvent = await Event.findOne({ $or: searchConditions }).lean();
        if (freshEvent && (freshEvent.cardTemplate || freshEvent.cardTemplateUrl)) {
          program = { ...(program || {}), ...freshEvent };
        }
      }
    }

    const mediaState = await mediaService.resolveRegistrationMedia(submission, null, program);
    // Prioritize the Event's current active card template over any stale registration cardTemplate!
    // NEVER fall back to legacy /card_template.png with 24 July graphics
    let resolvedTemplate = program?.cardTemplateUrl || program?.cardTemplate || '';
    if (!resolvedTemplate && submission.cardTemplate && !submission.cardTemplate.includes('card_template.png')) {
      resolvedTemplate = submission.cardTemplate;
    }

    return {
      ...submission,
      ...mediaState,
      cardTemplate: resolvedTemplate || null,
      program: program ? {
        ...program,
        cardTemplate: resolvedTemplate || null,
        cardTemplateUrl: resolvedTemplate || null
      } : null
    };
  }
}

export const registrationService = new RegistrationService();
