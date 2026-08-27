import { Payment } from '../../models/Payment.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';

export class FinanceService {
  /**
   * Calculate Event-Level Financial Summary & Global Metrics
   */
  async getFinancialOverview(eventId = null) {
    const query = { status: { $ne: 'rejected' }, isDeleted: { $ne: true } };
    if (eventId && eventId !== 'all') query.programId = eventId;

    const [approvedCouples, pendingCouples] = await Promise.all([
      Registration.countDocuments({ ...query, status: 'approved' }),
      Registration.countDocuments({ ...query, status: 'pending' })
    ]);

    // Aggregate captured payments
    const paymentQuery = { status: 'captured' };
    if (eventId && eventId !== 'all') paymentQuery.eventId = eventId;

    const paymentsAgg = await Payment.aggregate([
      { $match: paymentQuery },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const totalCapturedRevenue = paymentsAgg[0]?.totalRevenue || (approvedCouples * 1500);
    const pendingExpectedValue = pendingCouples * 1500;

    return {
      eventId: eventId || 'all',
      approvedCouples,
      pendingCouples,
      totalAttendees: approvedCouples * 2,
      totalCapturedRevenue,
      pendingExpectedValue,
      currency: 'INR'
    };
  }
}

export const financeService = new FinanceService();
