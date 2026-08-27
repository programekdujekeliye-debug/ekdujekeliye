import { apiClient } from '../apiClient';
import { BackupRecordItem } from '../../types/admin';

export interface GetBackupsParams {
  page?: number;
  limit?: number;
  type?: string;
}

export interface BackupsResponse {
  success: boolean;
  backups: BackupRecordItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const backupsApi = {
  async getBackups(params: GetBackupsParams = {}): Promise<BackupsResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.type && params.type !== 'all') query.append('type', params.type);

    const queryString = query.toString();
    return apiClient<BackupsResponse>(`/api/super-admin/backups${queryString ? `?${queryString}` : ''}`);
  },

  async runBackupNow(type: 'daily' | 'weekly' | 'monthly' | 'manual' = 'manual'): Promise<any> {
    return apiClient('/api/super-admin/backups/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
  }
};
