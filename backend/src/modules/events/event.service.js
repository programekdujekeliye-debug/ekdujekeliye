import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { generateEventSlug } from '../../utils/slug.js';

// In-Memory Short TTL Cache for Zero-Cost Reads
let publicEventsCache = null;
let publicEventsCacheExpiry = 0;
let adminEventsCache = null;
let adminEventsCacheExpiry = 0;
const slugCache = new Map();

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
   * Simple and Reliable Public Upcoming Events (2 Future Max -> If Zero then TBD)
   * Rule 1: Real future dated events (date >= today in Asia/Kolkata), max 2.
   * Rule 2: If future count = 0, return valid Date TBA/TBD event.
   * Rule 3: If nothing, return empty array (shows "New Events Coming Soon").
   */
  async getPublicUpcomingEvents() {
    const now = new Date();
    const istDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);

    const events = await Event.find(
      { status: { $ne: 'archived' } },
      {
        id: 1, sequenceNumber: 1, name: 1, shortName: 1, slug: 1, city: 1,
        venue: 1, venueAddress: 1, mapUrl: 1, description: 1, price: 1,
        status: 1, date: 1, time: 1, capacity: 1, bookedSeats: 1, isDateFinal: 1,
        isInquiryClosed: 1, registrationMode: 1, externalRegistrationUrl: 1,
        heroImage: 1, posterImage: 1
      }
    ).lean();

    if (!events || events.length === 0) return [];

    // 1. Future dated events
    const futureDatedEvents = events.filter(e => {
      if (!e.date || e.date === 'TBA' || e.date === 'TBD' || e.isDateFinal === false) return false;
      if (e.status === 'completed') return false;
      return e.date >= istDateStr;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    // RULE 1: Return maximum 2 upcoming events
    if (futureDatedEvents.length > 0) {
      const results = futureDatedEvents.slice(0, 2).map(prog => {
        const capacity = prog.capacity || 1000;
        const bookedSeats = prog.bookedSeats || 0;
        const availableSeats = Math.max(0, capacity - bookedSeats);
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
      return results;
    }

    // RULE 2: If future dated event count = 0, look for valid Date TBA / TBD event
    const tbaEvent = events.find(e => {
      return e.date === 'TBA' || e.date === 'TBD' || e.isDateFinal === false || !e.date || e.status === 'date_tba';
    });

    if (tbaEvent) {
      const mapped = {
        ...tbaEvent,
        capacity: tbaEvent.capacity || 1000,
        bookedSeats: tbaEvent.bookedSeats || 0,
        availableSeats: tbaEvent.capacity || 1000,
        isHousefull: false,
        isClosed: false
      };
      if (tbaEvent.slug) slugCache.set(tbaEvent.slug.toLowerCase(), mapped);
      if (tbaEvent.id) slugCache.set(tbaEvent.id.toLowerCase(), mapped);
      return [mapped];
    }

    // RULE 3: 0 future events and 0 TBA events
    return [];
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
