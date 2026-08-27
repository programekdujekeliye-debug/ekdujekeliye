import { Registration } from '../models/Registration.js';
import { logger } from '../utils/logger.js';

export const runPaymentReminders = async () => {
  logger.info('[Payment Reminders Job] Checking for pending unpaid reservations...');
  const cutoffTime = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes old

  const pendingSubmissions = await Registration.find({
    status: 'pending',
    createdAt: { $lte: cutoffTime },
    'paymentReminder.count': { $lt: 2 },
    isDeleted: { $ne: true }
  }).limit(50);

  logger.info(`[Payment Reminders Job] Found ${pendingSubmissions.length} pending submissions eligible for reminder.`);
  return {
    processedCount: pendingSubmissions.length
  };
};
