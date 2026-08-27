import { Payment } from '../../models/Payment.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';

export class FinanceService {
  /**
   * Calculate Event-Level Financial Summary & Global Metrics
   * 
   * Rule:
   * - Old historical/completed programs prior to today are excluded from the active financial overview.
   * - Calculations start fresh from active upcoming programs (e.g. September events onwards).
   * - If a specific event is selected, calculates specifically for that event.
   */
  async getFinancialOverview(eventId = null) {
    const isSingleEvent = eventId && eventId !== 'all';

    // 1. Fetch active programs or specific program
    let targetEventIds = [];
    const eventPriceMap = {};
    const eventDetailsMap = {};

    if (isSingleEvent) {
      targetEventIds = [eventId];
      const ev = await Event.findOne({ id: eventId }).lean();
      if (ev) {
        eventPriceMap[ev.id] = Number(ev.price) || 1500;
        eventDetailsMap[ev.id] = ev;
      }
    } else {
      // Active / upcoming events only (exclude old completed/test programs)
      const activeEvents = await Event.find({
        status: { $nin: ['completed', 'archived'] }
      }).lean();

      targetEventIds = activeEvents.map(e => e.id);
      activeEvents.forEach(e => {
        eventPriceMap[e.id] = Number(e.price) || 1500;
        eventDetailsMap[e.id] = e;
      });
    }

    const regQuery = {
      isDeleted: { $ne: true },
      programId: { $in: targetEventIds }
    };

    const [approvedCouples, pendingCouples] = await Promise.all([
      Registration.countDocuments({ ...regQuery, status: 'approved' }),
      Registration.countDocuments({ ...regQuery, status: 'pending' })
    ]);

    // Aggregate captured payments for target events
    const paymentQuery = {
      status: 'captured',
      eventId: { $in: targetEventIds }
    };

    const paymentsAgg = await Payment.aggregate([
      { $match: paymentQuery },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    let totalCapturedRevenue = 0;
    let pendingExpectedValue = 0;

    if (paymentsAgg.length > 0 && paymentsAgg[0].totalRevenue > 0) {
      totalCapturedRevenue = paymentsAgg[0].totalRevenue;
      pendingExpectedValue = pendingCouples * 1500;
    } else {
      // Calculate based on active registrations per target event
      const approvedByEvent = await Registration.aggregate([
        { $match: { ...regQuery, status: 'approved' } },
        { $group: { _id: '$programId', count: { $sum: 1 } } }
      ]);

      const pendingByEvent = await Registration.aggregate([
        { $match: { ...regQuery, status: 'pending' } },
        { $group: { _id: '$programId', count: { $sum: 1 } } }
      ]);

      approvedByEvent.forEach(item => {
        const price = eventPriceMap[item._id] || 1500;
        totalCapturedRevenue += item.count * price;
      });

      pendingByEvent.forEach(item => {
        const price = eventPriceMap[item._id] || 1500;
        pendingExpectedValue += item.count * price;
      });
    }

    // Build event breakdown for active programs
    const eventBreakdown = targetEventIds.map(eId => {
      const ev = eventDetailsMap[eId];
      const price = eventPriceMap[eId] || 1500;
      return {
        eventId: eId,
        name: ev?.name || eId,
        date: ev?.date || '',
        city: ev?.city || 'Surat',
        price,
        status: ev?.status || 'upcoming'
      };
    });

    return {
      eventId: eventId || 'all',
      approvedCouples,
      pendingCouples,
      totalAttendees: approvedCouples * 2,
      totalCapturedRevenue,
      pendingExpectedValue,
      currency: 'INR',
      eventBreakdown,
      scope: isSingleEvent ? 'single_event' : 'active_programs_only'
    };
  }
}

export const financeService = new FinanceService();
