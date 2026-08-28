import { apiClient } from '../apiClient';
import { ArchiveCandidate, MediaArchiveJob } from '../../types/admin';

export interface GetArchiveJobsParams {
  page?: number;
  limit?: number;
  status?: string;
  eventId?: string;
}

export interface ArchiveJobsResponse {
  success: boolean;
  jobs: MediaArchiveJob[];
  total: number;
  page: number;
  totalPages: number;
  summary: {
    QUEUED: number;
    COPYING: number;
    VERIFIED: number;
    ARCHIVED: number;
    FAILED: number;
  };
}

export const archiveApi = {
  async getCandidates(): Promise<ArchiveCandidate[]> {
    const res = await apiClient<{ success: boolean; candidates: ArchiveCandidate[] }>('/api/super-admin/archive/candidates');
    return res.candidates || [];
  },

  async startEventArchive(eventId: string): Promise<any> {
    return apiClient(`/api/super-admin/archive/events/${eventId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async pauseEventArchive(eventId: string): Promise<any> {
    return apiClient(`/api/super-admin/archive/events/${eventId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async resumeEventArchive(eventId: string): Promise<any> {
    return apiClient(`/api/super-admin/archive/events/${eventId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async retryEventFailed(eventId: string): Promise<any> {
    return apiClient(`/api/super-admin/archive/events/${eventId}/retry-failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async queueEventArchive(eventId: string): Promise<{ success: boolean; message: string; queuedCount: number }> {
    return apiClient('/api/super-admin/archive/queue-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
  },

  async getJobs(params: GetArchiveJobsParams = {}): Promise<ArchiveJobsResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.eventId && params.eventId !== 'all') query.append('eventId', params.eventId);

    const queryString = query.toString();
    return apiClient<ArchiveJobsResponse>(`/api/super-admin/archive/jobs${queryString ? `?${queryString}` : ''}`);
  },

  async retryFailed(eventId?: string): Promise<{ success: boolean; message: string }> {
    return apiClient('/api/super-admin/archive/retry-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
  },

  async cleanupPreflight(registrationId: string): Promise<any> {
    return apiClient(`/api/super-admin/archive/cleanup-preflight/${registrationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async createThumbnail(registrationId: string): Promise<any> {
    return apiClient(`/api/super-admin/archive/create-thumbnail/${registrationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async cleanupOriginal(registrationId: string): Promise<any> {
    return apiClient(`/api/super-admin/archive/cleanup-original/${registrationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
