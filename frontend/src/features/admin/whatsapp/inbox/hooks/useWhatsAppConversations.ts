import { useState, useEffect, useCallback, useRef } from 'react';
import {
  whatsappApi,
  WhatsappConversationItem
} from '@/services/admin/whatsappApi';
import toast from 'react-hot-toast';

export interface ConversationsFilterState {
  search: string;
  filter: 'all' | 'unread' | 'open' | 'window_open' | 'window_expired' | 'closed';
  selectedEventId: string;
}

export function useWhatsAppConversations() {
  const [conversations, setConversations] = useState<WhatsappConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    totalConversations: 0,
    openCount: 0,
    unreadCount: 0,
    unassignedCount: 0,
    windowExpiringSoonCount: 0
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState<ConversationsFilterState>({
    search: '',
    filter: 'all',
    selectedEventId: 'all'
  });

  // Keep a ref to previous list signature to avoid re-render thrashing during polling
  const prevSignatureRef = useRef<string>('');

  const fetchStats = useCallback(async () => {
    try {
      const data = await whatsappApi.getConversationStats();
      const s = data.stats || ({} as any);
      setStats({
        totalConversations: s.totalConversations || 0,
        openCount: s.openCount || 0,
        unreadCount: s.unreadCount || 0,
        unassignedCount: s.unassignedCount || 0,
        windowExpiringSoonCount: s.windowExpiringSoonCount || 0
      });
    } catch (_) {
      // Quiet fail on polling stats
    }
  }, []);

  const fetchConversations = useCallback(async (
    targetPage = 1,
    isQuietPoll = false
  ) => {
    if (!isQuietPoll) setLoading(true);

    try {
      const res = await whatsappApi.getConversations({
        page: targetPage,
        limit: pagination.limit,
        filter: filters.filter,
        eventId: filters.selectedEventId !== 'all' ? filters.selectedEventId : undefined,
        search: filters.search.trim() || undefined
      });

      // Quick signature check
      const currentSignature = (res.conversations || [])
        .map(c => `${c._id}:${c.unreadCount}:${c.lastMessageAt}:${c.status}`)
        .join('|');

      if (!isQuietPoll || currentSignature !== prevSignatureRef.current) {
        prevSignatureRef.current = currentSignature;
        setConversations(res.conversations || []);
        if (res.pagination) {
          setPagination({
            page: res.pagination.page,
            limit: res.pagination.limit,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages
          });
        }
      }
    } catch (err: any) {
      if (!isQuietPoll) {
        console.error('Error fetching conversations:', err);
        toast.error('Failed to load conversations.');
      }
    } finally {
      if (!isQuietPoll) setLoading(false);
    }
  }, [filters, pagination.limit]);

  // Initial load & filter changes
  useEffect(() => {
    fetchStats();
    fetchConversations(1, false);
  }, [fetchStats, fetchConversations]);

  // Quiet background sync every 8 seconds (no UI flicker)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchStats();
      fetchConversations(pagination.page, true);
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchStats, fetchConversations, pagination.page]);

  // Sync past historical conversations
  const syncHistorical = useCallback(async () => {
    try {
      setSyncing(true);
      toast.loading('Syncing historical messages from ledger...', { id: 'sync-hist' });
      const res = await whatsappApi.syncConversations();
      if (res.success) {
        toast.success(
          `Sync Complete: ${res.summary?.totalPhones || 0} contacts linked!`,
          { id: 'sync-hist' }
        );
        fetchStats();
        fetchConversations(1, false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync historical messages.', { id: 'sync-hist' });
    } finally {
      setSyncing(false);
    }
  }, [fetchStats, fetchConversations]);

  // Check or open a phone number
  const checkOrCreatePhone = useCallback(async (phone: string, inquiryId?: string) => {
    const res = await whatsappApi.checkOrCreateConversation({
      phone: phone.trim(),
      inquiryId: inquiryId ? inquiryId.trim() : undefined
    });
    if (res.success && res.conversationId) {
      fetchStats();
      fetchConversations(1, false);
      return res.conversationId;
    }
    throw new Error((res as any).error || 'Unable to open conversation for this contact.');
  }, [fetchStats, fetchConversations]);

  return {
    conversations,
    loading,
    syncing,
    stats,
    pagination,
    filters,
    setFilters,
    setPagination,
    refresh: () => {
      fetchStats();
      fetchConversations(pagination.page, false);
    },
    syncHistorical,
    checkOrCreatePhone
  };
}
