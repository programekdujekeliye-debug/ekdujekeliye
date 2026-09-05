import { apiClient } from '../apiClient';
import { API_BASE_URL } from '../../config';
import { FeedbackStats, FeedbackListFilter, FeedbackListResponse } from '../../types/feedback';

export const feedbackApi = {
  /**
   * Fetch aggregated feedback statistics
   */
  async getStats(eventId?: string): Promise<FeedbackStats> {
    const query = eventId && eventId !== 'all' ? `?eventId=${encodeURIComponent(eventId)}` : '';
    const res = await apiClient<{ success: boolean; stats: FeedbackStats }>(`/api/feedback/admin/stats${query}`);
    return res.stats;
  },

  /**
   * Fetch paginated list of couple feedback submissions with search & filters
   */
  async getList(filter: FeedbackListFilter = {}): Promise<FeedbackListResponse> {
    const params = new URLSearchParams();
    if (filter.eventId && filter.eventId !== 'all') params.append('eventId', filter.eventId);
    if (filter.status && filter.status !== 'all') params.append('status', filter.status);
    if (filter.rating && filter.rating !== 'all') params.append('rating', filter.rating);
    if (filter.testimonial && filter.testimonial !== 'all') params.append('testimonial', filter.testimonial);
    if (filter.search && filter.search.trim()) params.append('search', filter.search.trim());
    if (filter.page) params.append('page', String(filter.page));
    if (filter.limit) params.append('limit', String(filter.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient<FeedbackListResponse>(`/api/feedback/admin/list${qs}`);
  },

  /**
   * Toggle website testimonial permission for a feedback review
   */
  async toggleTestimonial(id: string): Promise<{ success: boolean; isTestimonialAllowed: boolean; message: string }> {
    return apiClient<{ success: boolean; isTestimonialAllowed: boolean; message: string }>(
      `/api/feedback/admin/${encodeURIComponent(id)}/toggle-testimonial`,
      { method: 'POST' }
    );
  },

  /**
   * Delete feedback record (Super Admin only)
   */
  async deleteFeedback(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/api/feedback/admin/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
  },

  /**
   * Construct download link for CSV or JSON export
   */
  getExportUrl(eventId?: string, format: 'csv' | 'json' = 'csv'): string {
    const params = new URLSearchParams();
    if (eventId && eventId !== 'all') params.append('eventId', eventId);
    params.append('format', format);
    return `${API_BASE_URL}/api/feedback/admin/export?${params.toString()}`;
  }
};
