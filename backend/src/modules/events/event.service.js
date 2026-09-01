import crypto from 'crypto';
import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../../models/WhatsappMessage.js';
import { normalizePhoneNumber, env } from '../../config/env.js';
import { maskPhoneNumber } from '../../integrations/whatsapp/whatsapp.service.js';
import { generateEventSlug } from '../../utils/slug.js';

// In-Memory Short TTL Cache for Zero-Cost Reads
let publicEventsCache = null;
let publicEventsCacheExpiry = 0;
let adminEventsCache = null;
let adminEventsCacheExpiry = 0;
const slugCache = new Map();

/**
 * Parse an event's date string (YYYY-MM-DD) and optional time (e.g. "8:30 PM", "10:00 AM", "20:30")
 * into an exact UTC Date timestamp representing the event start in Asia/Kolkata timezone (+05:30).
 */
export function parseEventStartTimestamp(dateStr, timeStr = '00:00') {
  if (!dateStr || dateStr === 'TBA' || dateStr === 'TBD') return null;
  try {
    const cleanDate = String(dateStr).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;

    let hours = 0;
    let minutes = 0;

    if (timeStr) {
      const cleanTime = String(timeStr).trim().toUpperCase();
      const match = cleanTime.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = match[3];
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const isoString = `${cleanDate}T${hh}:${mm}:00+05:30`;
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export class EventService {
  /**
   * Invalidate discovery caches on event mutations
   */
  invalidateCache() {
    publicEventsCache = null;
    publicEventsCacheExpiry = 0;
    adminEventsCache = null;
    adminEventsCacheExpiry = 0;
    slugCache.clear();
  }

  /**
   * Exact Public Upcoming Events Algorithm (Max 2 Future -> If Zero then TBD)
   * 1. Valid published future dated events whose actual start datetime (Asia/Kolkata) > now.
   * 2. Sort: eventStartAt ASC.
   * 3. Limit: max 2.
   * 4. If future count >= 1: RETURN ONLY those future dated events (NEVER append TBD as filler).
   * 5. ONLY IF future count === 0: return valid published TBD events (limit max 2).
   * 6. Past events (eventStartAt <= now) and archived events are excluded.
   * 7. If neither exists, return empty array [].
   */
  async getPublicUpcomingEvents() {
    const now = new Date();

    const events = await Event.find(
      { status: { $nin: ['archived', 'completed'] }, isActive: { $ne: false } },
      {
        id: 1, sequenceNumber: 1, name: 1, shortName: 1, slug: 1, city: 1,
        venue: 1, venueAddress: 1, mapUrl: 1, description: 1, price: 1,
        status: 1, date: 1, time: 1, capacity: 1, bookedSeats: 1, isDateFinal: 1,
        isInquiryClosed: 1, isRegistrationOpen: 1, isPaymentEnabled: 1,
        earlyRegistrationMode: 1, paymentOpenedAt: 1, paymentOpeningNote: 1,
        registrationMode: 1, externalRegistrationUrl: 1,
        heroImage: 1, posterImage: 1, isActive: 1
      }
    ).lean();

    if (!events || events.length === 0) return [];

    // 1. Calculate start datetime for dated events and filter future events
    const datedEventsWithTime = events
      .filter(e => {
        if (!e.date || e.date === 'TBA' || e.date === 'TBD' || e.isDateFinal === false || e.status === 'date_tba') {
          return false;
        }
        return true;
      })
      .map(e => {
        const startAt = parseEventStartTimestamp(e.date, e.time);
        return { ...e, eventStartAt: startAt };
      })
      .filter(e => e.eventStartAt && e.eventStartAt.getTime() > now.getTime())
      .sort((a, b) => a.eventStartAt.getTime() - b.eventStartAt.getTime() || (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    let selectedEvents = [];

    if (datedEventsWithTime.length >= 1) {
      // Step 2 & 4: Return ONLY future dated events, max 2 (DO NOT append TBD)
      selectedEvents = datedEventsWithTime.slice(0, 2);
    } else {
      // Step 5: ONLY when future dated count = 0, query valid published TBD events (max 2)
      const tbdEvents = events
        .filter(e => {
          return e.date === 'TBA' || e.date === 'TBD' || e.isDateFinal === false || !e.date || e.status === 'date_tba';
        })
        .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
        .slice(0, 2);

      selectedEvents = tbdEvents;
    }

    if (selectedEvents.length === 0) return [];

    return selectedEvents.map(prog => {
      const isTbd = prog.date === 'TBA' || prog.date === 'TBD' || prog.isDateFinal === false || !prog.date || prog.status === 'date_tba';
      const capacity = prog.capacity || 1000;
      const bookedSeats = prog.bookedSeats || 0;
      const availableSeats = isTbd ? capacity : Math.max(0, capacity - bookedSeats);

      const mapped = {
        ...prog,
        capacity,
        bookedSeats,
        availableSeats,
        isHousefull: prog.status === 'housefull',
        isClosed: prog.status === 'registration_closed' || prog.isInquiryClosed === true
      };

      if (prog.slug) slugCache.set(prog.slug.toLowerCase(), mapped);
      if (prog.id) slugCache.set(prog.id.toLowerCase(), mapped);
      return mapped;
    });
  }

  /**
   * Public discovery endpoint (Home Page)
   */
  async getPublicEvents() {
    return this.getPublicUpcomingEvents();
  }

  /**
   * Get single event by slug with real-time seat availability
   */
  async getEventBySlug(slug) {
    if (!slug) return null;
    const normalizedSlug = String(slug).toLowerCase().trim();

    // 1. Fast path: Memory Cache hit (0ms)
    if (slugCache.has(normalizedSlug)) {
      return slugCache.get(normalizedSlug);
    }

    // 2. Database lookup: Try direct indexed slug first, then ID, then Date, then ObjectId
    let event = await Event.findOne({ slug: normalizedSlug }).lean();
    if (!event) {
      event = await Event.findOne({ id: slug }).lean();
    }
    if (!event) {
      event = await Event.findOne({ date: slug }).lean();
    }
    if (!event && typeof slug === 'string' && slug.match(/^[0-9a-fA-F]{24}$/)) {
      event = await Event.findOne({ _id: slug }).lean();
    }
    if (!event) {
      event = await Event.findOne({
        $or: [{ slug: normalizedSlug }, { id: slug }, { date: slug }]
      }).lean();
    }

    if (!event) return null;

    const mapped = {
      ...event,
      isHousefull: event.status === 'housefull',
      isClosed: event.status === 'registration_closed' || event.isInquiryClosed === true
    };

    // Cache result
    if (event.slug) slugCache.set(event.slug.toLowerCase(), mapped);
    if (event.id) slugCache.set(event.id.toLowerCase(), mapped);
    if (event.date) slugCache.set(event.date.toLowerCase(), mapped);

    return mapped;
  }

  /**
   * Ultra-lightweight event selector options (< 2 KB)
   * Categorized: Upcoming first, then TBD, then Completed
   */
  async getEventOptions() {
    const events = await Event.find(
      { status: { $ne: 'archived' } },
      { id: 1, name: 1, shortName: 1, slug: 1, date: 1, time: 1, status: 1, city: 1, venue: 1, capacity: 1, price: 1, sequenceNumber: 1, isDateFinal: 1, isRegistrationOpen: 1, isPaymentEnabled: 1, earlyRegistrationMode: 1 }
    ).lean();

    return this.sortEventsCategorized(events);
  }


  /**
   * Helper: Sort events with Upcoming first, then TBD/TBA, then Completed
   */
  sortEventsCategorized(events) {
    const now = new Date();
    const istDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);

    const getRank = (e) => {
      if (e.status === 'completed' || e.status === 'archived') return 3; // Completed / Archived show last
      if (e.status === 'date_tba' || e.date === 'TBA' || e.date === 'TBD' || e.isDateFinal === false || !e.date) return 2; // TBD / TBA show middle
      if (e.date < istDateStr) return 3; // Past dated show last
      return 1; // Upcoming show FIRST
    };

    return [...events].sort((a, b) => {
      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) return rankA - rankB;

      // Upcoming (Rank 1): nearest date first
      if (rankA === 1) {
        return (a.date || '').localeCompare(b.date || '') || (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
      }
      // TBD (Rank 2): by sequenceNumber or name
      if (rankA === 2) {
        return (a.sequenceNumber || 0) - (b.sequenceNumber || 0) || (a.name || '').localeCompare(b.name || '');
      }
      // Completed (Rank 3): most recent completed first
      return (b.date || '').localeCompare(a.date || '') || (b.sequenceNumber || 0) - (a.sequenceNumber || 0);
    });
  }

  /**
   * Get full admin program list with registration breakdown (Ultra-Fast < 15ms)
   */
  async getAdminEvents() {
    const now = Date.now();
    if (adminEventsCache && now < adminEventsCacheExpiry) {
      return adminEventsCache;
    }

    const [programs, regStats] = await Promise.all([
      Event.find(
        {},
        {
          id: 1, sequenceNumber: 1, name: 1, shortName: 1, slug: 1, city: 1,
          venue: 1, venueAddress: 1, status: 1, date: 1, time: 1, capacity: 1,
          bookedSeats: 1, isDateFinal: 1, isInquiryClosed: 1, price: 1, archiveStatus: 1,
          registrationMode: 1, externalRegistrationUrl: 1, heroImage: 1, posterImage: 1
        }
      ).lean(),
      Registration.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: {
              programId: '$programId',
              programDate: '$programDate',
              status: '$status',
              isPaid: { $eq: ['$payment.status', 'captured'] },
              isPresent: { $eq: ['$attendance', 'present'] }
            },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const sortedPrograms = this.sortEventsCategorized(programs);

    const result = sortedPrograms.map(prog => {
      const progIdentifiers = new Set([
        prog.id,
        prog.slug,
        prog.date,
        `prog-${prog.date}`,
        prog.id ? String(prog.id).toLowerCase() : '',
        prog.slug ? String(prog.slug).toLowerCase() : ''
      ].filter(Boolean));

      let approved = 0;
      let pending = 0;
      let inquiry = 0;
      let rejected = 0;
      let present = 0;

      for (const bucket of regStats) {
        const { programId, programDate, status, isPaid, isPresent } = bucket._id;
        const matches = (programId && (progIdentifiers.has(programId) || progIdentifiers.has(String(programId).toLowerCase()))) ||
                        (programDate && (progIdentifiers.has(programDate) || programDate === prog.date));

        if (matches) {
          const count = bucket.count || 0;
          if (status === 'approved' || isPaid) {
            approved += count;
          } else if (status === 'rejected') {
            rejected += count;
          } else if (status === 'inquiry') {
            inquiry += count;
          } else {
            pending += count;
          }

          if (isPresent) {
            present += count;
          }
        }
      }

      const capacity = prog.capacity && prog.capacity > 0 ? prog.capacity : 1000;
      const isCapacityReached = approved >= capacity;
      const availableSlots = Math.max(0, capacity - approved);
      const totalBooked = approved + pending;

      let eventStatus = prog.status;
      if (isCapacityReached && eventStatus !== 'completed' && eventStatus !== 'archived') {
        eventStatus = 'housefull';
      }

      return {
        ...prog,
        capacity,
        status: eventStatus,
        isHousefull: isCapacityReached,
        totalBooked,
        bookingsCount: approved,
        approvedCount: approved,
        pendingCount: pending,
        inquiryCount: inquiry,
        rejectedCount: rejected,
        presentCount: present,
        availableSlots,
        availableSeats: availableSlots * 2,
        activeBookings: approved * 2,
        cplApproved: approved,
        cplPending: pending,
        cplInquiry: inquiry,
        cplRejected: rejected,
        ipApproved: approved,
        ipPending: pending,
        ipInquiry: inquiry,
        ipRejected: rejected
      };
    });

    adminEventsCache = result;
    adminEventsCacheExpiry = now + (10 * 1000); // 10s TTL
    return result;
  }


  /**
   * Get preview before owner enables payment & communication for an event
   */
  async getEnablePaymentPreview(eventId) {
    const event = await Event.findOne({
      $or: [{ id: eventId }, { slug: eventId }]
    }).lean();

    if (!event) {
      const err = new Error('Event not found.');
      err.status = 404;
      throw err;
    }

    if (event.status === 'archived' || event.status === 'completed' || event.status === 'cancelled') {
      const err = new Error(`Cannot enable payment for an event that is ${event.status}. Only upcoming published events can be activated.`);
      err.status = 400;
      throw err;
    }

    // Count confirmed attendees (paid or approved)
    const confirmedCount = await Registration.countDocuments({
      programId: event.id,
      $or: [{ status: 'approved' }, { 'payment.status': 'captured' }],
      isDeleted: { $ne: true }
    });

    // Count existing early registrations (active, unpaid, not cancelled)
    const earlyRegistrations = await Registration.find({
      programId: event.id,
      status: 'pending',
      'payment.status': { $ne: 'captured' },
      isDeleted: { $ne: true }
    }).select('phoneNumber inquiryId husbandName wifeName').lean();

    const eligibleRecipients = earlyRegistrations.filter(r => r.phoneNumber && String(r.phoneNumber).trim().length >= 10);

    const capacity = event.capacity || 1184;
    const confirmedSeats = confirmedCount * 2;
    const remainingCapacity = Math.max(0, capacity - confirmedSeats);

    return {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      eventTime: event.time,
      venue: event.venue,
      capacity,
      confirmedRegistrations: confirmedCount,
      confirmedSeats,
      remainingCapacity,
      existingEarlyRegistrationsCount: earlyRegistrations.length,
      eligibleRecipientsCount: eligibleRecipients.length,
      isPaymentEnabled: Boolean(event.isPaymentEnabled),
      earlyRegistrationMode: Boolean(event.earlyRegistrationMode),
      communicationsEnabled: Boolean(event.communicationsEnabled),
      paymentOpenedAt: event.paymentOpenedAt || null
    };
  }

  /**
   * Authoritative activation of Payment and WhatsApp communications for an upcoming event
   */
  async enablePaymentAndCommunications(eventId) {
    const event = await Event.findOne({
      $or: [{ id: eventId }, { slug: eventId }]
    });

    if (!event) {
      const err = new Error('Event not found.');
      err.status = 404;
      throw err;
    }

    if (event.status === 'archived' || event.status === 'completed' || event.status === 'cancelled') {
      const err = new Error(`Cannot activate payment for an event that is ${event.status}. Only active upcoming events are allowed.`);
      err.status = 400;
      throw err;
    }

    const activationTimestamp = event.paymentOpenedAt || new Date();

    event.isPaymentEnabled = true;
    event.communicationsEnabled = true;
    event.earlyRegistrationMode = false;
    if (event.sequenceNumber === 6 || event.sequenceNumber === 7 || event.id === 'prog-2026-09-07' || event.id === 'prog-2026-09-11' || event.id === 'prog-2026-09-12') {
      event.personalizedInvitationEnabled = false;

      // Cancel any future queued invitation jobs for this event
      await WhatsappMessage.updateMany(
        {
          eventId: { $in: [event.id, event.slug, 'prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-12'] },
          messageType: 'invitation',
          status: { $in: ['QUEUED', 'SENDING'] }
        },
        {
          $set: {
            status: 'CANCELLED',
            lastErrorMessage: 'DISABLED_FOR_EVENT'
          }
        }
      );
    }
    if (!event.paymentOpenedAt) {
      event.paymentOpenedAt = activationTimestamp;
    }
    await event.save();
    this.invalidateCache();

    // Query eligible existing early registrations
    const earlyRegistrations = await Registration.find({
      programId: event.id,
      status: 'pending',
      'payment.status': { $ne: 'captured' },
      isDeleted: { $ne: true }
    });

    const feeAmount = `₹${event.price || 1500}`;
    let queuedOpenMessages = 0;
    let scheduledReminders = 0;

    for (const reg of earlyRegistrations) {
      if (!reg.phoneNumber || String(reg.phoneNumber).trim().length < 10) continue;

      const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Valued Couple';
      const eventName = event.name || 'Ek Duje Ke Liye Seminar';
      const eventDate = event.date || '';
      const eventTime = event.time || '8:30 PM';
      const venue = event.venue || 'Sardar Patel Smruti Bhavan, Surat';
      const inquiryId = reg.inquiryId;

      // 1. Idempotent Payment Open Message (Queued immediately)
      const openIdempotencyKey = `PAYMENT_OPEN:${event.id}:${reg._id}:${event.paymentOpenedAt.getTime()}`;

      const openMsg = await WhatsappMessage.findOneAndUpdate(
        { idempotencyKey: openIdempotencyKey },
        {
          $setOnInsert: {
            messageId: `WA-OPEN-${crypto.randomBytes(8).toString('hex')}`,
            eventId: event.id,
            registrationId: reg._id,
            inquiryId,
            recipientPhone: normalizePhoneNumber(reg.phoneNumber),
            recipientMasked: maskPhoneNumber(reg.phoneNumber),
            templateName: 'edkl_payment_pending_v1',
            templateLanguage: 'en_US',
            templateCategory: 'UTILITY',
            messageType: 'payment_pending',
            trigger: 'payment_activation_open',
            executionSource: 'NORMAL',
            providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
            idempotencyKey: openIdempotencyKey,
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
            scheduledFor: new Date(),
            templateParameters: {
              customerName,
              eventName,
              registrationId: inquiryId,
              eventDate,
              eventTime,
              venue,
              feeAmount,
              inquiryId
            }
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      if (openMsg) queuedOpenMessages++;

      // 2. Schedule Follow-up Reminder at paymentOpenedAt + 24 hours (if still unpaid)
      const reminder24hTime = new Date(event.paymentOpenedAt.getTime() + 24 * 60 * 60 * 1000);
      const remIdempotencyKey = `PAYMENT_REMINDER_24H:${event.id}:${reg._id}`;

      const remMsg = await WhatsappMessage.findOneAndUpdate(
        { idempotencyKey: remIdempotencyKey },
        {
          $setOnInsert: {
            messageId: `WA-REM24-${crypto.randomBytes(8).toString('hex')}`,
            eventId: event.id,
            registrationId: reg._id,
            inquiryId,
            recipientPhone: normalizePhoneNumber(reg.phoneNumber),
            recipientMasked: maskPhoneNumber(reg.phoneNumber),
            templateName: 'edkl_payment_pending_v1',
            templateLanguage: 'en_US',
            templateCategory: 'UTILITY',
            messageType: 'payment_pending',
            trigger: 'payment_reminder_24h',
            executionSource: 'NORMAL',
            providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : 'META',
            idempotencyKey: remIdempotencyKey,
            status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
            scheduledFor: reminder24hTime,
            templateParameters: {
              customerName,
              eventName,
              registrationId: inquiryId,
              eventDate,
              eventTime,
              venue,
              feeAmount,
              inquiryId
            }
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      if (remMsg) scheduledReminders++;
    }

    return {
      success: true,
      message: `Payment & WhatsApp communication activated for ${event.name}.`,
      eventId: event.id,
      paymentOpenedAt: event.paymentOpenedAt,
      existingEarlyRegistrationsCount: earlyRegistrations.length,
      queuedOpenMessages,
      scheduledReminders
    };
  }
}

export const eventService = new EventService();
