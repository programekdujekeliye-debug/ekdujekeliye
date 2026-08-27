import { apiClient } from '../apiClient';

export const resourcesApi = {
  async getSystemResources(): Promise<any> {
    return apiClient('/api/admin/system/resources');
  },

  async triggerDatabaseBackup(): Promise<any> {
    return apiClient('/api/admin/system/backup', {
      method: 'POST'
    });
  },

  async getIntegrationsStatus(): Promise<any> {
    return apiClient('/api/admin/system/integrations');
  }
};
