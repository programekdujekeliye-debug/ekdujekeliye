import { apiClient } from '../apiClient';
import { Program } from '../../types/event';

export const eventsApi = {
  async getEvents(): Promise<Program[]> {
    return apiClient<Program[]>('/api/programs');
  },

  async createEvent(eventData: Partial<Program>): Promise<Program> {
    return apiClient<Program>('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
  },

  async updateEvent(id: string, eventData: Partial<Program>): Promise<Program> {
    return apiClient<Program>(`/api/programs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
  },

  async deleteEvent(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(`/api/programs/${id}`, {
      method: 'DELETE'
    });
  }
};
