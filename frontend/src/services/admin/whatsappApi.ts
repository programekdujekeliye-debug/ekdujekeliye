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

export interface EventCommunicationSummary {
  totalRegistrations: number;
  confirmedRegistrations: number;
  paymentPendingRegistrations: number;
  whatsappOptIn: number;
  whatsappOptOut: number;
  attendedRegistrations: number;
  totalMessagesAttempted: number;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesRead: number;
  totalMessagesFailed: number;
  totalMessagesScheduled: number;
  actionNeededCount: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
}

export interface MessageTypeStatItem {
  eligible: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
}

export interface EventCommunicationDashboardResponse {
  success: boolean;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  summary: EventCommunicationSummary;
  messageTypeStats: Record<string, MessageTypeStatItem>;
  eventSettings: Record<string, boolean>;
}

export interface RegistrationCommunicationRow {
  inquiryId: string;
  coupleName: string;
  maskedPhone: string;
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'COMPLIMENTARY';
  paymentAmount: number;
  passId: string | null;
  passStatus: string;
  whatsappOptIn: boolean;
  attendance: 'PRESENT' | 'ABSENT';
  messages: {
    registration: { status: string; sentAt?: string; deliveredAt?: string; readAt?: string; failedAt?: string; reasonIfMissing?: string };
    paymentReminder: { count: number; status: string; nextScheduledAt?: string; reasonIfMissing?: string };
    paymentConfirmed: { status: string; sentAt?: string; deliveredAt?: string; readAt?: string; failedAt?: string; reasonIfMissing?: string };
    invitation48h: { status: string; scheduledFor?: string; sentAt?: string; deliveredAt?: string; readAt?: string; failedAt?: string; reasonIfMissing?: string };
    reminder24h: { status: string; scheduledFor?: string; sentAt?: string; deliveredAt?: string; readAt?: string; failedAt?: string; reasonIfMissing?: string };
    feedback: { status: string; scheduledFor?: string; sentAt?: string; deliveredAt?: string; readAt?: string; failedAt?: string; reasonIfMissing?: string };
    gallery: { status: string; scheduledFor?: string; sentAt?: string; deliveredAt?: string; readAt?: string; failedAt?: string; reasonIfMissing?: string };
  };
  totals: {
    attempted: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    paymentReminders: number;
    manualBroadcasts: number;
  };
  lastCommunication: { messageType: string; status: string; at: string; templateName?: string } | null;
  nextCommunication: { messageType: string; scheduledFor: string; templateName?: string } | null;
  health: 'HEALTHY' | 'PENDING' | 'ACTION_NEEDED';
}

export interface RegistrationCommunicationListResponse {
  success: boolean;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  rows: RegistrationCommunicationRow[];
}

export interface PersonTimelineResponse {
  success: boolean;
  inquiryId: string;
  customerName: string;
  phoneNumberMasked: string;
  paymentStatus: string;
  passStatus: string;
  passId: string | null;
  whatsappOptIn: boolean;
  attendance: string;
  invitationVersion: number;
  totals: {
    attempted: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    paymentReminders: number;
    manualBroadcasts: number;
  };
  timeline: Array<{
    id: string;
    messageId: string;
    templateName: string;
    messageType: string;
    templateLanguage: string;
    trigger: string;
    status: string;
    attemptCount: number;
    maxAttempts: number;
    scheduledFor?: string;
    sentAt?: string;
    deliveredAt?: string;
    readAt?: string;
    failedAt?: string;
    lastErrorMessage?: string;
    providerMessageId?: string;
    createdAt: string;
  }>;
}

export const whatsappApi = {
  async getMetaTemplates(): Promise<{ success: boolean; metaTemplates: MetaTemplate[] }> {
    return apiClient<{ success: boolean; metaTemplates: MetaTemplate[] }>('/api/whatsapp/meta-templates');
  },

  async getEventDashboard(eventId: string): Promise<EventCommunicationDashboardResponse> {
    return apiClient<EventCommunicationDashboardResponse>(`/api/whatsapp/dashboard/events/${eventId}`);
  },

  async getEventRegistrations(
    eventId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      paymentStatus?: string;
      messageStatus?: string;
      messageType?: string;
      attendance?: string;
      health?: string;
    } = {}
  ): Promise<RegistrationCommunicationListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.paymentStatus && params.paymentStatus !== 'ALL') query.set('paymentStatus', params.paymentStatus);
    if (params.messageStatus && params.messageStatus !== 'ALL') query.set('messageStatus', params.messageStatus);
    if (params.messageType && params.messageType !== 'ALL') query.set('messageType', params.messageType);
    if (params.attendance && params.attendance !== 'ALL') query.set('attendance', params.attendance);
    if (params.health && params.health !== 'ALL') query.set('health', params.health);

    return apiClient<RegistrationCommunicationListResponse>(
      `/api/whatsapp/dashboard/events/${eventId}/registrations?${query.toString()}`
    );
  },

  async getTimeline(inquiryId: string): Promise<PersonTimelineResponse> {
    return apiClient<PersonTimelineResponse>(`/api/whatsapp/timeline/${inquiryId}`);
  },

  async previewBroadcast(
    eventId: string,
    audience: string
  ): Promise<{ success: boolean; totalRegistrations: number; eligibleCount: number; optedOutCount: number; missingPhoneCount: number; finalRecipientCount: number }> {
    return apiClient('/api/whatsapp/broadcasts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, audience })
    });
  },

  async sendBroadcast(data: {
    eventId: string;
    audience: string;
    templateKey: string;
    customMessage?: string;
  }): Promise<{ success: boolean; message: string; queuedCount: number }> {
    return apiClient('/api/whatsapp/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async triggerGallery(eventId: string, galleryUrl?: string): Promise<{ success: boolean; message: string; queuedCount: number }> {
    return apiClient(`/api/whatsapp/events/${eventId}/gallery-ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ galleryUrl })
    });
  },

  async resendMessage(inquiryId: string, templateKey: string): Promise<{ success: boolean; message: string }> {
    return apiClient('/api/whatsapp/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryId, templateKey })
    });
  },

  async runWorker(simulatedNow?: string): Promise<{ success: boolean; summary?: any; error?: string }> {
    return apiClient('/api/whatsapp/run-worker-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedNow })
    });
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
