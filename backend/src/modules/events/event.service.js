import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { generateEventSlug } from '../../utils/slug.js';

// In-Memory Short TTL Cache for Zero-Cost Public Reads (5 Minutes)
let publicEventsCache = null;
let publicEventsCacheExpiry = 0;
const slugCache = new Map();

export class EventService {
  /**
   * Invalidate public discovery caches on event mutations
   */
  invalidateCache() {
    publicEventsCache = null;
    publicEventsCacheExpiry = 0;
    slugCache.clear();
  }

  /**
   * Get all active & upcoming events for public discovery (Aggregated & Cached)
   * Blazing fast: single aggregation round-trip with in-memory caching.
   */
  async getPublicEvents() {
    const now = Date.now();
    if (publicEventsCache && now < publicEventsCacheExpiry) {
      return publicEventsCache;
    }

    const programs = await Event.find(
      { status: { $nin: ['completed', 'archived'] } },
      {
        id: 1,
        sequenceNumber: 1,
        name: 1,
        slug: 1,
        city: 1,
        venue: 1,
        mapUrl: 1,
        description: 1,
        heroImage: 1,
        price: 1,
        status: 1,
        featured: 1,
        registrationMode: 1,
        externalRegistrationUrl: 1,
        sortOrder: 1,
        date: 1,
        time: 1,
        capacity: 1,
        isDateFinal: 1,
        cardTemplate: 1,
        isInquiryClosed: 1
      }
    )
      .sort({ sequenceNumber: 1, sortOrder: 1, date: 1 })
      .lean();

    if (programs.length === 0) {
      // If no upcoming, check if there's any completed/past fallback
      publicEventsCache = [];
      publicEventsCacheExpiry = now + 60 * 1000;
      return [];
    }

    const programIds = programs.map(p => p.id);

    // Single aggregation query for all event booking counts
    const activeCounts = await Registration.aggregate([
      {
        $match: {
          programId: { $in: programIds },
          status: { $in: ['approved', 'pending'] },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$programId',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = new Map();
    activeCounts.forEach(c => countMap.set(c._id, c.count));

    const result = programs.map(prog => {
      const activeCount = countMap.get(prog.id) || 0;
      const activeBookings = activeCount * 2;
      const availableSeats = Math.max(0, prog.capacity - activeBookings);

      return {
        ...prog,
        bookingsCount: activeBookings,
        activeBookings,
        availableSeats,
        isSoldOut: availableSeats <= 0
      };
    });

    publicEventsCache = result;
    publicEventsCacheExpiry = now + 5 * 60 * 1000; // 5 minutes cache
    return result;
  }

  /**
   * Get single event by slug with lean projection
   */
  async getEventBySlug(slug) {
    const now = Date.now();
    const cached = slugCache.get(slug);
    if (cached && now < cached.expiry) {
      return cached.data;
    }

    const event = await Event.findOne(
      { slug },
      {
        id: 1,
        sequenceNumber: 1,
        name: 1,
        slug: 1,
        city: 1,
        venue: 1,
        mapUrl: 1,
        description: 1,
        heroImage: 1,
        price: 1,
        status: 1,
        featured: 1,
        registrationMode: 1,
        externalRegistrationUrl: 1,
        date: 1,
        time: 1,
        capacity: 1,
        isDateFinal: 1,
        cardTemplate: 1,
        isInquiryClosed: 1
      }
    ).lean();

    if (!event) return null;

    const activeCount = await Registration.countDocuments({
      programId: event.id,
      status: { $in: ['approved', 'pending'] },
      isDeleted: { $ne: true }
    });
    const activeBookings = activeCount * 2;
    const availableSeats = Math.max(0, event.capacity - activeBookings);

    const data = {
      ...event,
      activeBookings,
      availableSeats,
      isSoldOut: availableSeats <= 0
    };

    slugCache.set(slug, { data, expiry: now + (5 * 60 * 1000) }); // 5 minutes cache
    return data;
  }

  /**
   * Get full admin program list with registration breakdown
   */
  async getAdminEvents() {
    const programs = await Event.find({}).sort({ sequenceNumber: 1, date: 1 }).lean();
    const programIds = programs.map(p => p.id);

    // Fast batch aggregation by programId and status
    const statusCounts = await Registration.aggregate([
      {
        $match: {
          programId: { $in: programIds },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            programId: '$programId',
            status: '$status',
            isCpl: { $regexMatch: { input: '$inquiryId', regex: /^CPL/i } },
            isIp: { $regexMatch: { input: '$inquiryId', regex: /^IP/i } }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = new Map();
    statusCounts.forEach(item => {
      const pId = item._id.programId;
      if (!statsMap.has(pId)) {
        statsMap.set(pId, {
          approved: 0, pending: 0, inquiry: 0, rejected: 0,
          cplApproved: 0, cplPending: 0, cplInquiry: 0, cplRejected: 0,
          ipApproved: 0, ipPending: 0, ipInquiry: 0, ipRejected: 0
        });
      }
      const s = statsMap.get(pId);
      const st = item._id.status;
      const cnt = item.count;

      if (st === 'approved') s.approved += cnt;
      else if (st === 'pending') s.pending += cnt;
      else if (st === 'inquiry') s.inquiry += cnt;
      else if (st === 'rejected') s.rejected += cnt;

      if (item._id.isCpl) {
        if (st === 'approved') s.cplApproved += cnt;
        else if (st === 'pending') s.cplPending += cnt;
        else if (st === 'inquiry') s.cplInquiry += cnt;
        else if (st === 'rejected') s.cplRejected += cnt;
      }
      if (item._id.isIp) {
        if (st === 'approved') s.ipApproved += cnt;
        else if (st === 'pending') s.ipPending += cnt;
        else if (st === 'inquiry') s.ipInquiry += cnt;
        else if (st === 'rejected') s.ipRejected += cnt;
      }
    });

    const results = programs.map(prog => {
      const s = statsMap.get(prog.id) || {
        approved: 0, pending: 0, inquiry: 0, rejected: 0,
        cplApproved: 0, cplPending: 0, cplInquiry: 0, cplRejected: 0,
        ipApproved: 0, ipPending: 0, ipInquiry: 0, ipRejected: 0
      };

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
        cplApproved: s.cplApproved,
        cplPending: s.cplPending,
        cplInquiry: s.cplInquiry,
        cplRejected: s.cplRejected,
        ipApproved: s.ipApproved,
        ipPending: s.ipPending,
        ipInquiry: s.ipInquiry,
        ipRejected: s.ipRejected
      };
    });

    return results;
  }
}

export const eventService = new EventService();
