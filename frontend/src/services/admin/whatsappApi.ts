import { apiClient } from '../apiClient';
import { WhatsappTemplate, MetaTemplate } from '../../types/whatsapp';

export interface WhatsappLogItem {
  _id: string;
  inquiryId?: string;
  recipientPhone: string;
  templateName: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  providerMessageId?: string;
  templateParameters?: Record<string, any>;
  createdAt: string;
  providerErrorMessage?: string;
}

export const whatsappApi = {
  async getMetaTemplates(): Promise<{ success: boolean; metaTemplates: MetaTemplate[] }> {
    return apiClient<{ success: boolean; metaTemplates: MetaTemplate[] }>('/api/whatsapp/meta-templates');
  },

  async sendTestMessage(
    recipientPhone: string,
    templateKey: string,
    submissionId?: string,
    customVariables?: Record<string, string>
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>('/api/whatsapp/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientPhone, templateKey, submissionId, customVariables })
    });
  },

  async getLogs(limit: number = 30): Promise<{ success: boolean; logs: WhatsappLogItem[] }> {
    return apiClient<{ success: boolean; logs: WhatsappLogItem[] }>(`/api/whatsapp/logs?limit=${limit}`);
  },

  async getTemplates(): Promise<WhatsappTemplate[]> {
    return apiClient<WhatsappTemplate[]>('/api/whatsapp/templates');
  },

  async getActiveTemplate(type: string = 'pass_delivery'): Promise<WhatsappTemplate> {
    return apiClient<WhatsappTemplate>(`/api/whatsapp/templates/active?type=${type}`);
  },

  async createTemplate(templateData: { name: string; text: string; type: string }): Promise<WhatsappTemplate> {
    return apiClient<WhatsappTemplate>('/api/whatsapp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    });
  },

  async activateTemplate(id: string): Promise<{ success: boolean; template: WhatsappTemplate }> {
    return apiClient(`/api/whatsapp/templates/${id}/use`, {
      method: 'POST'
    });
  },

  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    return apiClient(`/api/whatsapp/templates/${id}`, {
      method: 'DELETE'
    });
  }
};
