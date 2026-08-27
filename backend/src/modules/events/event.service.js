import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { generateEventSlug } from '../../utils/slug.js';

// In-Memory Short TTL Cache for Zero-Cost Public Reads
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
   */
  async getPublicEvents() {
    const now = Date.now();
    if (publicEventsCache && now < publicEventsCacheExpiry) {
      return publicEventsCache;
    }

    const programs = await Event.find(
      { status: { $ne: 'archived' } },
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

    const result = [];
    for (const prog of programs) {
      const activeCount = await Registration.countDocuments({
        programId: prog.id,
        status: { $in: ['approved', 'pending'] },
        isDeleted: { $ne: true }
      });
      const activeBookings = activeCount * 2;
      const availableSeats = Math.max(0, prog.capacity - activeBookings);

      result.push({
        ...prog,
        bookingsCount: activeBookings,
        activeBookings,
        availableSeats,
        isSoldOut: availableSeats <= 0
      });
    }

    publicEventsCache = result;
    publicEventsCacheExpiry = now + (3 * 60 * 1000); // 3 minutes cache
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

    slugCache.set(slug, { data, expiry: now + (2 * 60 * 1000) }); // 2 minutes cache
    return data;
  }

  /**
   * Get full admin program list with registration breakdown (Paged / Scoped)
   */
  async getAdminEvents() {
    const programs = await Event.find({}).sort({ sequenceNumber: 1, date: 1 }).lean();
    const results = [];

    for (const prog of programs) {
      const [approvedCount, pendingCount, inquiryCount, rejectedCount] = await Promise.all([
        Registration.countDocuments({ programId: prog.id, status: 'approved', isDeleted: { $ne: true } }),
        Registration.countDocuments({ programId: prog.id, status: 'pending', isDeleted: { $ne: true } }),
        Registration.countDocuments({ programId: prog.id, status: 'inquiry', isDeleted: { $ne: true } }),
        Registration.countDocuments({ programId: prog.id, status: 'rejected', isDeleted: { $ne: true } })
      ]);

      const [cplApproved, cplPending, cplInquiry, cplRejected] = await Promise.all([
        Registration.countDocuments({ programId: prog.id, status: 'approved', isDeleted: { $ne: true }, inquiryId: /^CPL/i }),
        Registration.countDocuments({ programId: prog.id, status: 'pending', isDeleted: { $ne: true }, inquiryId: /^CPL/i }),
        Registration.countDocuments({ programId: prog.id, status: 'inquiry', isDeleted: { $ne: true }, inquiryId: /^CPL/i }),
        Registration.countDocuments({ programId: prog.id, status: 'rejected', isDeleted: { $ne: true }, inquiryId: /^CPL/i })
      ]);

      const [ipApproved, ipPending, ipInquiry, ipRejected] = await Promise.all([
        Registration.countDocuments({ programId: prog.id, status: 'approved', isDeleted: { $ne: true }, inquiryId: /^IP/i }),
        Registration.countDocuments({ programId: prog.id, status: 'pending', isDeleted: { $ne: true }, inquiryId: /^IP/i }),
        Registration.countDocuments({ programId: prog.id, status: 'inquiry', isDeleted: { $ne: true }, inquiryId: /^IP/i }),
        Registration.countDocuments({ programId: prog.id, status: 'rejected', isDeleted: { $ne: true }, inquiryId: /^IP/i })
      ]);

      const activeBookings = (approvedCount + pendingCount) * 2;
      const availableSeats = Math.max(0, prog.capacity - activeBookings);

      results.push({
        ...prog,
        activeBookings,
        availableSeats,
        approvedCount,
        pendingCount,
        inquiryCount,
        rejectedCount,
        cplApproved,
        cplPending,
        cplInquiry,
        cplRejected,
        ipApproved,
        ipPending,
        ipInquiry,
        ipRejected
      });
    }

    return results;
  }
}

export const eventService = new EventService();
