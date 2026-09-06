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
  programId?: string;
  programName?: string;
  programDate?: string;
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'COMPLIMENTARY';
  paymentAmount: number;
  passId: string | null;
  passStatus: string;
  whatsappOptIn: boolean;
  attendance: 'PRESENT' | 'ABSENT';
  messages: {
    registration: { status: string; sentAt?: string; deliveredAt?: string; readAt?: string; failedAt?: string; reasonIfMissing?: string };
    paymentReminder: {
      count: number;
      sentCount?: number;
      failedCount?: number;
      status: string;
      lastError?: string | null;
      lastErrorCode?: string | null;
      attempts?: Array<{
        messageId?: string;
        trigger: string;
        status: string;
        sentAt?: string;
        deliveredAt?: string;
        readAt?: string;
        failedAt?: string;
        error?: string | null;
        errorCode?: string | null;
      }>;
      nextScheduledAt?: string;
      reasonIfMissing?: string;
    };
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
  health: 'GOOD' | 'HEALTHY' | 'WAITING' | 'PENDING' | 'ACTION_NEEDED';
  healthReason?: string;
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
    providerErrorCode?: string;
    providerErrorMessage?: string;
    lastErrorCode?: string;
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

  async retryFailedMessages(eventId: string): Promise<{ success: boolean; message: string; requeuedCount: number }> {
    return apiClient(`/api/whatsapp/events/${eventId}/retry-failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async runWorker(options?: { simulatedNow?: string; eventId?: string }): Promise<{ success: boolean; summary?: any; error?: string }> {
    return apiClient('/api/whatsapp/run-worker-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    });
  },


  async getPostEventStatus(eventId: string): Promise<{
    success: boolean;
    eventId: string;
    eventName: string;
    eventDate: string;
    midnightAt: string;
    isPastMidnight: boolean;
    lifecycleStatus: 'NOT_READY' | 'READY_TO_SEND' | 'SENT';
    presentCount: number;
    eligibleWhatsappCount: number;
    alreadySentCount: number;
    defaultGalleryUrl: string;
    feedbackEnabled: boolean;
  }> {
    return apiClient(`/api/whatsapp/events/${eventId}/post-event-status`);
  },

  async triggerPostEventSend(eventId: string, payload: { galleryUrl?: string; forceSend?: boolean }): Promise<{
    success: boolean;
    message: string;
    queuedCount: number;
    alreadySentCount: number;
    totalAttendees: number;
  }> {
    return apiClient(`/api/whatsapp/events/${eventId}/post-event-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async previewSpecificBroadcast(payload: {
    eventId: string;
    rawNumbers: string;
    messageMode?: 'FREE_TEXT' | 'TEMPLATE';
    templateKey?: string;
  }): Promise<{
    success: boolean;
    inputCount: number;
    matchedCount: number;
    unmatchedCount: number;
    windowOpenCount: number;
    windowClosedCount: number;
    optedOutCount: number;
    eligibleCount: number;
    messageMode: string;
    recipients: Array<{
      phone: string;
      maskedPhone: string;
      inquiryId: string;
      customerName: string;
      paymentStatus: string;
      isWindowOpen: boolean;
      windowExpiresAt: string | null;
    }>;
  }> {
    return apiClient('/api/whatsapp/broadcasts/specific-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async sendSpecificBroadcast(payload: {
    eventId: string;
    rawNumbers: string;
    messageMode?: 'FREE_TEXT' | 'TEMPLATE';
    templateKey?: string;
    customMessage?: string;
  }): Promise<{
    success: boolean;
    message: string;
    queuedCount: number;
    skippedClosedWindowCount: number;
    skippedOptOutCount: number;
  }> {
    return apiClient('/api/whatsapp/broadcasts/specific-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
  },

  // ==========================================
  // TWO-WAY WHATSAPP HUMAN SUPPORT INBOX
  // ==========================================

  async getConversations(params: {
    page?: number;
    limit?: number;
    search?: string;
    filter?: string;
    eventId?: string;
  } = {}): Promise<{
    success: boolean;
    pagination: { total: number; page: number; limit: number; totalPages: number };
    conversations: WhatsappConversationItem[];
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.filter) query.set('filter', params.filter);
    if (params.eventId) query.set('eventId', params.eventId);
    return apiClient(`/api/whatsapp/conversations?${query.toString()}`);
  },

  async getConversationStats(): Promise<{
    success: boolean;
    stats: {
      totalConversations: number;
      openCount: number;
      unreadCount: number;
      unassignedCount: number;
      windowExpiringSoonCount: number;
    };
  }> {
    return apiClient('/api/whatsapp/conversations/stats');
  },

  async getConversationDetails(conversationId: string): Promise<{
    success: boolean;
    conversation: WhatsappConversationItem;
    messages: WhatsappThreadMessage[];
    notes: ConversationNote[];
  }> {
    return apiClient(`/api/whatsapp/conversations/${conversationId}`);
  },

  async replyConversation(conversationId: string, text: string, replyToMessageId?: string): Promise<{
    success: boolean;
    status: string;
    providerMessageId: string;
    message: any;
  }> {
    return apiClient(`/api/whatsapp/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, replyToMessageId })
    });
  },

  async templateReplyConversation(conversationId: string, templateKey: string, variables?: Record<string, any>): Promise<{
    success: boolean;
    status: string;
    providerMessageId: string;
    message: string;
  }> {
    return apiClient(`/api/whatsapp/conversations/${conversationId}/template-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateKey, variables })
    });
  },

  async addConversationNote(conversationId: string, text: string): Promise<{
    success: boolean;
    notes: ConversationNote[];
  }> {
    return apiClient(`/api/whatsapp/conversations/${conversationId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  },

  async markConversationRead(conversationId: string): Promise<{ success: boolean; unreadCount: number }> {
    return apiClient(`/api/whatsapp/conversations/${conversationId}/read`, {
      method: 'POST'
    });
  },

  async assignConversation(conversationId: string, adminId?: string | null, adminName?: string | null): Promise<{
    success: boolean;
    conversation: WhatsappConversationItem;
  }> {
    return apiClient(`/api/whatsapp/conversations/${conversationId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, adminName })
    });
  },

  async updateConversationStatus(conversationId: string, status: 'OPEN' | 'CLOSED'): Promise<{
    success: boolean;
    status: string;
  }> {
    return apiClient(`/api/whatsapp/conversations/${conversationId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  },

  async checkOrCreateConversation(payload: { phone?: string; inquiryId?: string; customerName?: string }): Promise<{
    success: boolean;
    conversationId: string;
    conversation: WhatsappConversationItem;
    totalMessages: number;
  }> {
    return apiClient('/api/whatsapp/conversations/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async syncConversations(): Promise<{
    success: boolean;
    summary: {
      totalPhones: number;
      createdConversations: number;
      updatedConversations: number;
      linkedMessages: number;
    };
  }> {
    return apiClient('/api/whatsapp/conversations/sync', {
      method: 'POST'
    });
  },

  async simulateInboundMessage(payload: { phone: string; text: string; customerName?: string }): Promise<{
    success: boolean;
    conversationId: string;
    message: any;
    windowExpiresAt: string;
  }> {
    return apiClient('/api/whatsapp/simulate-inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async getBroadcastOverview(): Promise<BroadcastCampaignOverviewResponse> {
    return apiClient<BroadcastCampaignOverviewResponse>('/api/whatsapp/campaigns/overview');
  },

  async getBroadcastLogs(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    campaign?: string;
  }): Promise<BroadcastLogsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.campaign) query.set('campaign', params.campaign);
    return apiClient<BroadcastLogsResponse>(`/api/whatsapp/campaigns/logs?${query.toString()}`);
  },

  async launchBroadcastCampaign(payload: {
    templateKey: string;
    audienceCohort: string;
    testOnly?: boolean;
    testRecipientPhone?: string;
  }): Promise<{
    success: boolean;
    message: string;
    recipientCount?: number;
    mode?: string;
    providerMessageId?: string;
  }> {
    return apiClient('/api/whatsapp/campaigns/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
};

export interface BroadcastCampaignOverviewResponse {
  summary: {
    totalCampaigns: number;
    totalBroadcastMessages: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    sending: number;
    deliveredRate: number;
    readRate: number;
  };
  campaigns: Array<{
    id: string;
    templateName: string;
    title: string;
    category: string;
    audience: string;
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    sendingCount: number;
    status: 'SENDING' | 'COMPLETED' | 'QUEUED';
    startedAt: string;
    lastSentAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    recipientPhone: string;
    recipientMasked: string;
    customerName: string;
    status: string;
    providerMessageId: string;
    sentAt: string;
  }>;
}

export interface BroadcastLogItem {
  id: string;
  messageId: string;
  providerMessageId: string;
  recipientPhone: string;
  recipientMasked: string;
  customerName: string;
  inquiryId: string;
  templateName: string;
  content: string;
  status: string;
  sentAt: string;
  updatedAt: string;
}

export interface BroadcastLogsResponse {
  logs: BroadcastLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ConversationNote {
  _id?: string;
  text: string;
  adminId?: string;
  adminName?: string;
  createdAt: string;
}

export interface WhatsappConversationItem {
  _id: string;
  phone: string;
  phoneMasked: string;
  customerName: string;
  inquiryId?: string;
  eventId?: string;
  status: 'OPEN' | 'CLOSED';
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview?: string;
  lastMessageDirection?: 'INBOUND' | 'OUTBOUND';
  lastMessageStatus?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  customerServiceWindowExpiresAt?: string;
  isWindowOpen: boolean;
  windowRemainingSeconds: number;
  assignedAdminId?: string;
  assignedAdminName?: string;
  notesCount?: number;
  paymentStatus?: 'PAID' | 'PENDING' | 'UNKNOWN';
  pass?: {
    passId?: string;
    status?: string;
    version?: number;
    tier?: string;
    scannedAt?: string;
    isRevoked?: boolean;
  };
  registration?: {
    _id: string;
    inquiryId: string;
    coupleName: string;
    programId?: string;
    programName?: string;
    programDate?: string;
    paymentStatus: 'PAID' | 'PENDING' | 'UNKNOWN';
    paymentAmount: number;
    attendance: string;
    couplePhoto?: string | null;
  } | null;
  couplePhoto?: string | null;
  registrationId?: any;
}

export interface WhatsappThreadMessage {
  _id: string;
  messageId?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  content: string;
  contentType: string;
  mediaId?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaCaption?: string;
  templateName?: string;
  templateParameters?: Record<string, any>;
  messageType?: string;
  trigger?: string;
  executionSource?: string;
  sentByAdminName?: string;
  isInternalNote?: boolean;
  providerMessageId?: string;
  providerErrorCode?: string;
  providerErrorMessage?: string;
  receivedAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}
