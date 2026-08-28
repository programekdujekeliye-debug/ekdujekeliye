import { apiClient } from '../apiClient';

export interface DashboardSummary {
  stats: {
    total: number;
    approved: number;
    pending: number;
    inquiry: number;
    rejected: number;
    present: number;
    attendanceRate: number;
  };
  recentSubmissions: Array<{
    inquiryId: string;
    coupleName: string;
    partner1Name: string;
    partner2Name: string;
    phoneNumber: string;
    city: string;
    status: string;
    paymentStatus: string;
    attendance: string;
    createdAt: string;
    programId: string;
  }>;
  activeEvents: Array<{
    id: string;
    name: string;
    shortName: string;
    date: string;
    time: string;
    status: string;
    city: string;
    venue: string;
    capacity: number;
  }>;
}

export const dashboardApi = {
  async getAdminDashboard(eventId?: string): Promise<DashboardSummary> {
    const query = eventId && eventId !== 'all' ? `?eventId=${encodeURIComponent(eventId)}` : '';
    return apiClient<DashboardSummary>(`/api/admin/dashboard${query}`);
  },

  async getSuperAdminDashboard(): Promise<any> {
    return apiClient<any>('/api/super-admin/dashboard');
  }
};
