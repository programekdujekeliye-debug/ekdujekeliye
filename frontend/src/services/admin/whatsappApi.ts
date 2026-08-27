import { apiClient } from '../apiClient';
import { WhatsappTemplate } from '../../types/whatsapp';

export const whatsappApi = {
  async getTemplates(): Promise<WhatsappTemplate[]> {
    return apiClient<WhatsappTemplate[]>('/api/whatsapp-templates');
  },

  async getActiveTemplate(type: string = 'pass_delivery'): Promise<WhatsappTemplate> {
    return apiClient<WhatsappTemplate>(`/api/whatsapp-templates/active?type=${type}`);
  },

  async createTemplate(templateData: { name: string; text: string; type: string }): Promise<WhatsappTemplate> {
    return apiClient<WhatsappTemplate>('/api/whatsapp-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    });
  },

  async activateTemplate(id: string): Promise<{ success: boolean; template: WhatsappTemplate }> {
    return apiClient(`/api/whatsapp-templates/${id}/use`, {
      method: 'POST'
    });
  },

  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    return apiClient(`/api/whatsapp-templates/${id}`, {
      method: 'DELETE'
    });
  }
};
