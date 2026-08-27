import { apiClient } from '../apiClient';
import { Submission, SubmissionsResponse, DuplicateGroup } from '../../types/registration';

export interface GetSubmissionsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  programId?: string;
  attendance?: string;
  sortBy?: string;
  sortOrder?: string;
}

export const registrationsApi = {
  async getSubmissions(params: GetSubmissionsParams = {}): Promise<SubmissionsResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search) query.append('search', params.search);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.programId && params.programId !== 'all') query.append('programId', params.programId);
    if (params.attendance && params.attendance !== 'all') query.append('attendance', params.attendance);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const queryString = query.toString();
    return apiClient<SubmissionsResponse>(`/api/submissions${queryString ? `?${queryString}` : ''}`);
  },

  async getDuplicates(): Promise<DuplicateGroup[]> {
    return apiClient<DuplicateGroup[]>('/api/submissions/duplicates');
  },

  async getTrash(page: number = 1, limit: number = 10): Promise<SubmissionsResponse> {
    return apiClient<SubmissionsResponse>(`/api/submissions/trash?page=${page}&limit=${limit}`);
  },

  async approveSubmission(inquiryId: string): Promise<{ success: boolean; submission: Submission }> {
    return apiClient(`/api/submissions/${inquiryId}/approve`, { method: 'POST' });
  },

  async rejectSubmission(inquiryId: string, reason?: string): Promise<{ success: boolean; submission: Submission }> {
    return apiClient(`/api/submissions/${inquiryId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
  },

  async markAttendance(inquiryId: string, attendance: 'present' | 'absent' | 'unmarked'): Promise<{ success: boolean }> {
    return apiClient(`/api/submissions/${inquiryId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance })
    });
  },

  async bulkUpdateAttendance(inquiryIds: string[], attendance: 'present' | 'absent' | 'unmarked'): Promise<{ success: boolean }> {
    return apiClient('/api/submissions/bulk-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryIds, attendance })
    });
  },

  async attendanceByAbsentees(programId: string, absentInquiryIds: string[]): Promise<{ success: boolean }> {
    return apiClient('/api/submissions/attendance-by-absentees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId, absentInquiryIds })
    });
  },

  async bulkMove(inquiryIds: string[], targetProgramId: string): Promise<{ success: boolean; message: string }> {
    return apiClient('/api/submissions/bulk-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryIds, targetProgramId })
    });
  },

  async softDelete(inquiryId: string): Promise<{ success: boolean }> {
    return apiClient(`/api/submissions/${inquiryId}`, { method: 'DELETE' });
  },

  async bulkDelete(inquiryIds: string[]): Promise<{ success: boolean }> {
    return apiClient('/api/submissions/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryIds })
    });
  },

  async restoreSubmission(inquiryId: string): Promise<{ success: boolean }> {
    return apiClient(`/api/submissions/${inquiryId}/restore`, { method: 'POST' });
  },

  async permanentDelete(inquiryId: string): Promise<{ success: boolean }> {
    return apiClient(`/api/submissions/${inquiryId}/permanent`, { method: 'DELETE' });
  },

  async updateSubmission(inquiryId: string, updateData: Partial<Submission>): Promise<{ success: boolean; submission: Submission }> {
    return apiClient(`/api/submissions/${inquiryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
  }
};
