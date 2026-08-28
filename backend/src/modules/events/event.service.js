import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
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
        isInquiryClosed: 1, registrationMode: 1, externalRegistrationUrl: 1,
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
    const normalizedSlug = slug.toLowerCase();

    // 1. Fast path: Memory Cache hit (0ms)
    if (slugCache.has(normalizedSlug)) {
      return slugCache.get(normalizedSlug);
    }

    // 2. Database lookup: Try direct indexed slug first, then ID
    let event = await Event.findOne({ slug: normalizedSlug }).lean();
    if (!event) {
      event = await Event.findOne({ id: slug }).lean();
    }
    if (!event) {
      event = await Event.findOne({
        $or: [{ slug: normalizedSlug }, { id: slug }]
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

    return mapped;
  }

  /**
   * Ultra-lightweight event selector options (< 2 KB)
   * Categorized: Upcoming first, then TBD, then Completed
   */
  async getEventOptions() {
    const events = await Event.find(
      { status: { $ne: 'archived' } },
      { id: 1, name: 1, shortName: 1, date: 1, time: 1, status: 1, city: 1, venue: 1, sequenceNumber: 1, isDateFinal: 1 }
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
   * Get full admin program list with registration breakdown
   */
  async getAdminEvents() {
    const programs = await Event.find(
      {},
      {
        id: 1, sequenceNumber: 1, name: 1, shortName: 1, slug: 1, city: 1,
        venue: 1, venueAddress: 1, status: 1, date: 1, time: 1, capacity: 1,
        bookedSeats: 1, isDateFinal: 1, isInquiryClosed: 1, price: 1, archiveStatus: 1,
        registrationMode: 1, externalRegistrationUrl: 1, heroImage: 1, posterImage: 1
      }
    ).lean();

    const sortedPrograms = this.sortEventsCategorized(programs);

    const statsMap = new Map();
    try {
      const statsList = await Registration.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$programId',
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            inquiry: { $sum: { $cond: [{ $eq: ['$status', 'inquiry'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            present: { $sum: { $cond: [{ $eq: ['$attendance', true] }, 1, 0] } }
          }
        }
      ]);
      statsList.forEach(s => {
        if (s && s._id) statsMap.set(s._id, s);
      });
    } catch (e) {
      console.warn('[eventService] Stats aggregation fallback:', e.message);
    }

    return sortedPrograms.map(prog => {
      const s = statsMap.get(prog.id) || { approved: 0, pending: 0, inquiry: 0, rejected: 0, present: 0 };
      const activeBookings = (s.approved + s.pending) * 2;
      const availableSeats = Math.max(0, prog.capacity - activeBookings);

      return {
        ...prog,
        activeBookings,
        availableSeats,
        approvedCount: s.approved,
        pendingCount: s.pending,
        inquiryCount: s.inquiry,
        rejectedCount: s.rejected,
        cplApproved: s.approved,
        cplPending: s.pending,
        cplInquiry: s.inquiry,
        cplRejected: s.rejected,
        ipApproved: s.approved,
        ipPending: s.pending,
        ipInquiry: s.inquiry,
        ipRejected: s.rejected,
        presentCount: s.present
      };
    });
  }
}

export const eventService = new EventService();
