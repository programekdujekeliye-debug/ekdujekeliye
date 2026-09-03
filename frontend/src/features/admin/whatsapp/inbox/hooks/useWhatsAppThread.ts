import { useState, useEffect, useCallback, useRef } from 'react';
import {
  whatsappApi,
  WhatsappConversationItem,
  WhatsappThreadMessage,
  ConversationNote
} from '@/services/admin/whatsappApi';
import toast from 'react-hot-toast';

export function useWhatsAppThread(
  conversationId: string | null,
  onThreadUpdated?: () => void
) {
  const [activeConv, setActiveConv] = useState<WhatsappConversationItem | null>(null);
  const [messages, setMessages] = useState<WhatsappThreadMessage[]>([]);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  // Track previous message IDs to avoid full re-renders if messages haven't changed
  const prevMsgSignatureRef = useRef<string>('');

  const fetchThread = useCallback(async (isQuiet = false) => {
    if (!conversationId) {
      setActiveConv(null);
      setMessages([]);
      setNotes([]);
      return;
    }

    if (!isQuiet) setLoading(true);

    try {
      const data = await whatsappApi.getConversationDetails(conversationId);
      setActiveConv(data.conversation || null);
      setNotes(data.notes || []);

      const incomingMsgs = data.messages || [];
      const newSignature = incomingMsgs.map(m => `${m._id}:${m.status}`).join('|');

      if (!isQuiet || newSignature !== prevMsgSignatureRef.current) {
        prevMsgSignatureRef.current = newSignature;
        setMessages(incomingMsgs);
      }
    } catch (err: any) {
      if (!isQuiet) {
        console.error('Error loading thread:', err);
        toast.error('Failed to load messages.');
      }
    } finally {
      if (!isQuiet) setLoading(false);
    }
  }, [conversationId]);

  // Load immediately when selected conversation changes
  useEffect(() => {
    fetchThread(false);
  }, [fetchThread]);

  // Quiet polling while a thread is open (every 4 seconds for real-time chat feeling)
  useEffect(() => {
    if (!conversationId) return;
    const timer = setInterval(() => {
      fetchThread(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [conversationId, fetchThread]);

  // Optimistic Reply
  const sendReply = useCallback(async (text: string) => {
    if (!conversationId || !text.trim()) return;

    const trimmed = text.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: WhatsappThreadMessage = {
      _id: tempId,
      direction: 'OUTBOUND',
      content: trimmed,
      contentType: 'text',
      status: 'SENDING',
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      executionSource: 'ADMIN_REPLY',
      sentByAdminName: 'You'
    };

    // Optimistically update message list
    setMessages(prev => [...prev, optimisticMsg]);
    setSendingReply(true);

    try {
      const res = await whatsappApi.replyConversation(conversationId, trimmed);

      if (res.success) {
        // Replace temp message with server record
        const record = (res as any).message || (res as any).messageRecord;
        setMessages(prev =>
          prev.map(m => (m._id === tempId ? { ...(record || optimisticMsg), status: 'SENT' } : m))
        );
        // Refresh thread quietly to update window status
        fetchThread(true);
        if (onThreadUpdated) onThreadUpdated();
      } else {
        throw new Error((res as any).error || 'Failed to dispatch reply.');
      }
    } catch (err: any) {
      // Mark as failed
      setMessages(prev =>
        prev.map(m => (m._id === tempId ? { ...m, status: 'FAILED' } : m))
      );
      toast.error(err.message || 'Error sending message.');
    } finally {
      setSendingReply(false);
    }
  }, [conversationId, fetchThread, onThreadUpdated]);

  // Send Approved Meta Template
  const sendTemplate = useCallback(async (
    templateKey: string,
    parameters?: Record<string, string>
  ) => {
    if (!conversationId) return;

    setSendingTemplate(true);
    try {
      const res = await whatsappApi.templateReplyConversation(conversationId, templateKey, parameters);
      if (res.success) {
        toast.success('Template message dispatched successfully!');
        await fetchThread(true);
        if (onThreadUpdated) onThreadUpdated();
      } else {
        throw new Error((res as any).error || 'Failed to dispatch template.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error sending template.');
    } finally {
      setSendingTemplate(false);
    }
  }, [conversationId, fetchThread, onThreadUpdated]);

  // Add Internal Note
  const addNote = useCallback(async (text: string) => {
    if (!conversationId || !text.trim()) return;

    setAddingNote(true);
    try {
      const res = await whatsappApi.addConversationNote(conversationId, text.trim());
      if (res.success) {
        toast.success('Internal note recorded.');
        await fetchThread(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save note.');
    } finally {
      setAddingNote(false);
    }
  }, [conversationId, fetchThread]);

  // Toggle Status (Open / Closed)
  const toggleStatus = useCallback(async () => {
    if (!conversationId || !activeConv) return;
    const nextStatus = activeConv.status === 'OPEN' ? 'CLOSED' : 'OPEN';

    try {
      const res = await whatsappApi.updateConversationStatus(conversationId, nextStatus);
      if (res.success) {
        setActiveConv(prev => (prev ? { ...prev, status: nextStatus } : null));
        toast.success(`Conversation marked as ${nextStatus}.`);
        if (onThreadUpdated) onThreadUpdated();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update conversation status.');
    }
  }, [conversationId, activeConv, onThreadUpdated]);

  return {
    activeConv,
    messages,
    notes,
    loading,
    sendingReply,
    sendingTemplate,
    addingNote,
    sendReply,
    sendTemplate,
    addNote,
    toggleStatus,
    refreshThread: () => fetchThread(false)
  };
}
