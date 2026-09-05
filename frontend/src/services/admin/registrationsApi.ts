import { apiClient } from '../apiClient';
import { Submission, SubmissionsResponse, DuplicateGroup } from '../../types/registration';

export interface GetSubmissionsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  programId?: string;
  attendance?: string;
  isVip?: string;
  frameExportStatus?: string;
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
    if (params.paymentStatus && params.paymentStatus !== 'all') query.append('paymentStatus', params.paymentStatus);
    if (params.programId && params.programId !== 'all') query.append('programId', params.programId);
    if (params.attendance && params.attendance !== 'all') query.append('attendance', params.attendance);
    if (params.isVip) query.append('isVip', params.isVip);
    if (params.frameExportStatus && params.frameExportStatus !== 'all') query.append('frameExportStatus', params.frameExportStatus);
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

  async updateSubmission(inquiryId: string, updateData: any, photoFile?: File | null): Promise<{ success: boolean; submission: Submission }> {
    if (photoFile) {
      const formData = new FormData();
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined && updateData[key] !== null) {
          formData.append(key, typeof updateData[key] === 'object' ? JSON.stringify(updateData[key]) : String(updateData[key]));
        }
      });
      formData.append('couplePhoto', photoFile);
      return apiClient(`/api/submissions/${inquiryId}`, {
        method: 'PUT',
        body: formData
      });
    }

    return apiClient(`/api/submissions/${inquiryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
  },

  async markFramesExported(inquiryIds: string[], batchNumber?: number, status: 'EXPORTED' | 'NOT_EXPORTED' = 'EXPORTED'): Promise<{ success: boolean; modifiedCount: number; exportedAt: string }> {
    return apiClient('/api/submissions/mark-frame-exported', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryIds, batchNumber, status })
    });
  },

  async bulkUpdateFrameAlignments(alignments: Array<{ inquiryId: string; photoZoom: number; photoOffsetX: number; photoOffsetY: number }>): Promise<{ success: boolean; modifiedCount: number }> {
    return apiClient('/api/submissions/bulk-alignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alignments })
    });
  }
};

