export interface FinanceOverviewData {
  grossRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  totalTransactions: number;
  averageTicketValue: number;
  pendingTransactionsCount: number;
  pendingAmount: number;
  eventBreakdown?: Array<{
    eventId: string;
    name: string;
    date: string;
    city: string;
    price: number;
    paidRegistrations: number;
    grossRevenue: number;
    refunds: number;
    netRevenue: number;
  }>;
}
