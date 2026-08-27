import { apiClient } from '../apiClient';
import { SiteSettings, DatabaseStats, AdminNotification } from '../../types/admin';

export const settingsApi = {
  async getSettings(): Promise<SiteSettings> {
    return apiClient<SiteSettings>('/api/settings');
  },

  async updateSettings(settings: Partial<SiteSettings>): Promise<{ success: boolean; settings: SiteSettings }> {
    return apiClient('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  },

  async getDbStatus(): Promise<DatabaseStats> {
    return apiClient<DatabaseStats>('/api/db-status');
  },

  async getNotifications(): Promise<AdminNotification[]> {
    return apiClient<AdminNotification[]>('/api/notifications');
  },

  async dismissNotification(id: string): Promise<{ success: boolean }> {
    return apiClient('/api/notifications/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  },

  async clearAllData(): Promise<{ success: boolean; message: string }> {
    return apiClient('/api/admin/clear-all-data', {
      method: 'POST'
    });
  }
};
