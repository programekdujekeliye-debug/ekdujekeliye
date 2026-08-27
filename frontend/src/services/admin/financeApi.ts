import { apiClient } from '../apiClient';
import { FinanceOverviewData } from '../../types/finance';

export const financeApi = {
  async getOverview(programId?: string): Promise<FinanceOverviewData> {
    const url = programId && programId !== 'all'
      ? `/api/finance/overview?programId=${encodeURIComponent(programId)}`
      : '/api/finance/overview';
    const res = await apiClient<any>(url);
    const raw = res.summary || res;
    const gross = raw.totalCapturedRevenue ?? raw.grossRevenue ?? 0;
    const refunds = raw.totalRefunds ?? 0;
    const net = raw.netRevenue ?? (gross - refunds);
    const couples = raw.approvedCouples ?? raw.totalTransactions ?? 0;
    const avg = couples > 0 ? Math.round(gross / couples) : 1500;
    const pendingVal = raw.pendingExpectedValue ?? raw.pendingAmount ?? 0;
    const pendingCouples = raw.pendingCouples ?? raw.pendingTransactionsCount ?? 0;

    return {
      grossRevenue: gross,
      totalRefunds: refunds,
      netRevenue: net,
      totalTransactions: couples,
      averageTicketValue: avg,
      pendingTransactionsCount: pendingCouples,
      pendingAmount: pendingVal,
      eventBreakdown: raw.eventBreakdown || []
    };
  }
};
