'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  whatsappApi,
  WhatsappConversationItem,
  WhatsappThreadMessage,
  ConversationNote
} from '../../../services/admin/whatsappApi';
import { MetaTemplate } from '../../../types/whatsapp';
import { Program } from '../../../types/event';
import {
  MessageSquareIcon,
  SearchIcon,
  ClockIcon,
  RefreshCwIcon,
  CheckIcon,
  AlertTriangleIcon,
  XIcon,
  TicketIcon,
  ActivityIcon,
  FileTextIcon,
  ExternalLinkIcon,
  UsersIcon,
  ChevronDownIcon,
  SparklesIcon
} from '../../../components/Icons';
import { LuxurySelect, SelectOption } from '../../../components/LuxurySelect';
import toast from 'react-hot-toast';

interface WhatsAppInboxProps {
  events: Program[];
  metaTemplates: MetaTemplate[];
  onOpenTimeline?: (inquiryId: string) => void;
}

const QUICK_REPLIES = [
  'Payment received, thank you! Your seat is confirmed.',
  'Please refresh your Digital Pass page to view your QR code.',
  'The venue is Sardar Patel Smruti Bhavan, Surat.',
  'Parking is available near the main auditorium entrance.',
  'Please share a screenshot of the issue you are facing.',
  'Our support team is checking this for you right now.'
];

export const WhatsAppInbox: React.FC<WhatsAppInboxProps> = ({
  events,
  metaTemplates,
  onOpenTimeline
}) => {
  // Stats
  const [stats, setStats] = useState({
    totalConversations: 0,
    openCount: 0,
    unreadCount: 0,
    unassignedCount: 0,
    windowExpiringSoonCount: 0
  });

  // Conversations List & Pagination
  const [conversations, setConversations] = useState<WhatsappConversationItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'open' | 'window_open' | 'window_expired' | 'window_expiring_soon' | 'closed'>('all');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // Active Conversation Thread
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<WhatsappConversationItem | null>(null);
  const [messages, setMessages] = useState<WhatsappThreadMessage[]>([]);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Composer States
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('edkl_payment_confirmed_pass_v1');
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Side Details Drawer (Desktop & Mobile)
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Mobile View Toggle
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await whatsappApi.getConversationStats();
      if (res.success && res.stats) {
        setStats(res.stats);
      }
    } catch (_) {}
  }, []);

  // Fetch Conversations
  const fetchConversations = useCallback(async (pageToLoad = 1, silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await whatsappApi.getConversations({
        page: pageToLoad,
        limit: 25,
        search,
        filter,
        eventId: selectedEventId === 'all' ? undefined : selectedEventId
      });

      if (res.success) {
        setConversations(res.conversations || []);
        setPagination(res.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 });
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(err.message || 'Failed to fetch conversations.');
      }
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, [search, filter, selectedEventId]);

  // Fetch Active Thread Details
  const fetchThreadDetails = useCallback(async (convId: string, markRead = true, silent = false) => {
    try {
      if (!silent) setLoadingDetails(true);
      const res = await whatsappApi.getConversationDetails(convId);
      if (res.success) {
        setActiveConv(res.conversation);
        setMessages(res.messages || []);
        setNotes(res.notes || []);

        if (markRead && res.conversation.unreadCount > 0) {
          await whatsappApi.markConversationRead(convId);
          setConversations(prev => prev.map(c => c._id === convId ? { ...c, unreadCount: 0 } : c));
          fetchStats();
        }
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(err.message || 'Failed to load conversation thread.');
      }
    } finally {
      if (!silent) setLoadingDetails(false);
    }
  }, [fetchStats]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchConversations(1, false);
  }, [fetchStats, fetchConversations]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages]);

  // Live Auto-Refresh (Every 3.5 seconds) - Updates without page reloading!
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchConversations(pagination.page, true);
      if (selectedConvId) {
        fetchThreadDetails(selectedConvId, false, true);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [fetchStats, fetchConversations, fetchThreadDetails, pagination.page, selectedConvId]);

  // Select conversation
  const handleSelectConversation = (conv: WhatsappConversationItem) => {
    setSelectedConvId(conv._id);
    setMobileShowChat(true);
    fetchThreadDetails(conv._id, true);
  };

  // Free-Text Reply
  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConvId || !replyText.trim()) return;

    if (composerMode === 'note') {
      handleAddNote(e);
      return;
    }

    try {
      setSendingReply(true);
      const res = await whatsappApi.replyConversation(selectedConvId, replyText.trim());
      if (res.success) {
        toast.success('WhatsApp reply dispatched.');
        setReplyText('');
        await fetchThreadDetails(selectedConvId, false);
        fetchConversations(pagination.page, true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send WhatsApp reply.');
    } finally {
      setSendingReply(false);
    }
  };

  // Approved Template Reply
  const handleSendTemplate = async () => {
    if (!selectedConvId || !selectedTemplateKey) return;

    try {
      setSendingTemplate(true);
      const res = await whatsappApi.templateReplyConversation(selectedConvId, selectedTemplateKey);
      if (res.success) {
        toast.success('Approved WhatsApp template sent.');
        await fetchThreadDetails(selectedConvId, false);
        fetchConversations(pagination.page, true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send template.');
    } finally {
      setSendingTemplate(false);
    }
  };

  // Add Note
  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToAdd = (composerMode === 'note' ? replyText : newNoteText).trim();
    if (!selectedConvId || !textToAdd) return;

    try {
      setAddingNote(true);
      const res = await whatsappApi.addConversationNote(selectedConvId, textToAdd);
      if (res.success) {
        toast.success('Internal note saved.');
        setNotes(res.notes || []);
        if (composerMode === 'note') {
          setReplyText('');
          setComposerMode('reply');
        } else {
          setNewNoteText('');
        }
        fetchConversations(pagination.page, true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add note.');
    } finally {
      setAddingNote(false);
    }
  };

  // Status Toggle
  const handleToggleStatus = async () => {
    if (!selectedConvId || !activeConv) return;
    const newStatus = activeConv.status === 'OPEN' ? 'CLOSED' : 'OPEN';

    try {
      await whatsappApi.updateConversationStatus(selectedConvId, newStatus);
      setActiveConv(prev => prev ? { ...prev, status: newStatus } : null);
      setConversations(prev => prev.map(c => c._id === selectedConvId ? { ...c, status: newStatus } : c));
      toast.success(`Conversation marked as ${newStatus}.`);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatWindowRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m left`;
  };

  const getEventName = (eventId?: string) => {
    if (!eventId) return 'General Inquiry';
    const found = events.find(e => e.id === eventId || (e as any)._id === eventId || e.slug === eventId);
    return found ? (found.shortName || found.name) : eventId;
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Global Metrics Bar (Compact & Responsive) */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 ${mobileShowChat ? 'hidden md:grid' : 'grid'}`}>
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Inquiries</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.totalConversations}</div>
          <span className="text-[10px] text-slate-400 font-medium">All live chat threads</span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">Active Open</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">{stats.openCount}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Requiring support</span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs">
          <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            Unread
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mt-0.5">{stats.unreadCount}</div>
          <span className="text-[10px] text-rose-600 font-medium">Awaiting operator reply</span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">Expiring Soon</span>
          <div className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5">{stats.windowExpiringSoonCount}</div>
          <span className="text-[10px] text-amber-700 font-medium">&lt; 2h window left</span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Unassigned</span>
          <div className="text-xl sm:text-2xl font-black text-slate-700 mt-0.5">{stats.unassignedCount}</div>
          <span className="text-[10px] text-slate-400 font-medium">Team claim pool</span>
        </div>
      </div>

      {/* 2. Main Two-Column Luxury Chat Layout */}
      <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-xs overflow-hidden flex flex-col md:flex-row h-[calc(100dvh-180px)] md:h-[calc(100vh-220px)] min-h-[580px] max-h-[880px]">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CONVERSATIONS DIRECTORY */}
        {/* ========================================================================= */}
        <div className={`w-full md:w-[360px] lg:w-[410px] flex flex-col border-r border-slate-200/80 bg-slate-50/40 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Search, Filter & Seminar Select Header */}
          <div className="p-3 sm:p-3.5 border-b border-slate-200/80 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <MessageSquareIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Direct Inquiries</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Meta WhatsApp Cloud API</p>
                </div>
              </div>
              <button
                onClick={() => {
                  fetchStats();
                  fetchConversations(pagination.page);
                }}
                disabled={loadingConversations}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                title="Refresh Inquiries"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingConversations ? 'animate-spin text-rose-600' : ''}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, EK-ID..."
                className="w-full pl-9 pr-3.5 py-1.5 sm:py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Event Dropdown Filter */}
            <div className="w-full">
              <LuxurySelect
                value={selectedEventId}
                onChange={(val) => setSelectedEventId(val)}
                options={[
                  { value: 'all', label: 'All Seminar Slots' },
                  ...events.map((evt) => ({
                    value: evt.id || (evt as any)._id,
                    label: `${evt.name} — ${evt.city}`,
                    badge: evt.date || 'TBA',
                    sublabel: evt.venue
                  }))
                ]}
                placeholder="Filter by Seminar Slot..."
                searchable
                variant="card"
                size="sm"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread (${stats.unreadCount})` },
                { id: 'open', label: 'Open' },
                { id: 'window_open', label: '24h Active' },
                { id: 'window_expired', label: 'Expired' },
                { id: 'closed', label: 'Closed' }
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filter === pill.id
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {loadingConversations && conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-600" />
                <span>Loading inquiries...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-1.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <MessageSquareIcon className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-700 block">No conversations found</span>
                <span className="text-[11px] text-slate-400 block max-w-xs mx-auto">
                  Incoming WhatsApp messages from attendees will automatically appear here in real-time.
                </span>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConvId === conv._id;
                const initials = (conv.customerName || 'WG')
                  .split(' ')
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={conv._id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-3 rounded-2xl flex items-start gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white shadow-sm border border-rose-200 ring-1 ring-rose-500/20'
                        : 'hover:bg-white bg-transparent'
                    }`}
                  >
                    {/* Couple Avatar */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-xs flex-shrink-0 shadow-xs ${
                      conv.unreadCount > 0
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                          {conv.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium flex-shrink-0">
                          {formatTimeAgo(conv.lastMessageAt)}
                        </span>
                      </div>

                      {/* Phone & Inquiry Badges */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                        <span className="font-mono">{conv.phoneMasked}</span>
                        {conv.inquiryId && (
                          <span className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-700 rounded font-mono font-bold">
                            {conv.inquiryId}
                          </span>
                        )}
                        {conv.registration?.paymentStatus === 'PAID' && (
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">
                            PAID
                          </span>
                        )}
                      </div>

                      {/* Snippet */}
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                        {conv.lastMessageDirection === 'OUTBOUND' && <span className="text-slate-400">You: </span>}
                        {conv.lastMessagePreview || 'New inquiry'}
                      </p>

                      {/* 24h Window Badge */}
                      <div className="mt-1.5 flex items-center justify-between">
                        {conv.isWindowOpen ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {formatWindowRemaining(conv.windowRemainingSeconds)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            Window Expired
                          </span>
                        )}

                        {conv.unreadCount > 0 && (
                          <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black shadow-xs">
                            {conv.unreadCount} new
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: ACTIVE CHAT CANVAS */}
        {/* ========================================================================= */}
        <div className={`flex-1 flex flex-col bg-[#FAF9F6] relative ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          {!selectedConvId || !activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 mb-3 shadow-xs">
                <MessageSquareIcon className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">Select an Attendee Inquiry</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                Choose a conversation from the left to view registration details, verified payment state, and reply directly through Meta Cloud API.
              </p>
            </div>
          ) : (
            <>
              {/* Top Chat Header */}
              <div className="p-3 sm:p-3.5 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs z-10">
                <div className="flex items-center gap-2.5">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <span>← Inquiries</span>
                  </button>

                  <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-extrabold text-xs shadow-xs flex-shrink-0">
                    {(activeConv.customerName || 'WG').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{activeConv.customerName}</h4>
                      <span className="text-xs font-mono text-slate-500 font-bold hidden sm:inline">{activeConv.phoneMasked}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {activeConv.inquiryId && (
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-200 font-mono">
                          {activeConv.inquiryId}
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 text-[10px] font-bold rounded border border-rose-200">
                        {getEventName(activeConv.eventId)}
                      </span>
                      <span className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded ${
                        activeConv.paymentStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {activeConv.paymentStatus === 'PAID' ? 'PAID (₹1500)' : 'PAYMENT PENDING'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Header Action Buttons */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {activeConv.inquiryId && onOpenTimeline && (
                    <button
                      onClick={() => onOpenTimeline(activeConv.inquiryId!)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="View Lifecycle Timeline"
                    >
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Timeline</span>
                    </button>
                  )}

                  {activeConv.inquiryId && (
                    <a
                      href={`/pass/${activeConv.inquiryId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-all cursor-pointer flex items-center gap-1"
                      title="View Digital Pass"
                    >
                      <TicketIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pass</span>
                      <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                  )}

                  <button
                    onClick={() => setShowDetailsDrawer(!showDetailsDrawer)}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-200 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <FileTextIcon className="w-3.5 h-3.5" />
                    <span>Notes ({notes.length})</span>
                  </button>

                  <button
                    onClick={handleToggleStatus}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeConv.status === 'OPEN'
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {activeConv.status === 'OPEN' ? 'Close Case' : 'Reopen'}
                  </button>
                </div>
              </div>

              {/* 24-Hour Customer Window Notification Bar */}
              <div className={`px-4 py-1.5 text-xs font-bold flex items-center justify-between border-b ${
                activeConv.isWindowOpen
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${activeConv.isWindowOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="text-[11px] sm:text-xs">
                    {activeConv.isWindowOpen
                      ? `24-Hour Customer Window OPEN (${formatWindowRemaining(activeConv.windowRemainingSeconds)}) — Free-form replies active.`
                      : '24-Hour Customer Window EXPIRED — Meta requires an approved template to message.'}
                  </span>
                </div>
              </div>

              {/* Messages Thread Canvas */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {loadingDetails ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-600" />
                    Loading conversation thread...
                  </div>
                ) : (
                  <>
                    {messages.map((m) => {
                      const isInbound = m.direction === 'INBOUND';
                      const isAutomation = m.executionSource !== 'ADMIN_REPLY' && m.executionSource !== 'INBOUND_WEBHOOK' && !!m.templateName;

                      // 1. Automation Lifecycle Message (Centered Gold/Ivory Card)
                      if (isAutomation) {
                        return (
                          <div key={m._id} className="flex flex-col items-center my-2">
                            <div className="bg-white border border-slate-200 shadow-xs px-4 py-2 rounded-2xl max-w-md text-center space-y-1">
                              <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                <ActivityIcon className="w-3 h-3 text-rose-700" />
                                <span>Automation: {m.messageType?.replace(/_/g, ' ') || m.templateName}</span>
                              </div>
                              <p className="text-xs font-medium text-slate-800">
                                {m.content || `Template: ${m.templateName}`}
                              </p>
                              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
                                <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`font-bold ${
                                  m.status === 'READ' ? 'text-sky-600' : m.status === 'DELIVERED' ? 'text-emerald-600' : 'text-slate-500'
                                }`}>
                                  ✓ {m.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 2. Inbound WhatsApp Message from Attendee (Left-aligned Clean Card)
                      if (isInbound) {
                        return (
                          <div key={m._id} className="flex items-start gap-2 max-w-[85%] sm:max-w-[72%]">
                            <div className="w-7 h-7 rounded-xl bg-slate-300 text-slate-700 flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
                              {(activeConv.customerName || 'C')[0]}
                            </div>
                            <div className="bg-white border border-slate-200/80 p-3 rounded-2xl rounded-tl-sm shadow-xs space-y-1">
                              <span className="text-[10px] font-extrabold text-slate-500 block">Customer</span>
                              <p className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed">
                                {m.content}
                              </p>
                              <span className="text-[9px] text-slate-400 block text-right font-mono">
                                {new Date(m.receivedAt || m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // 3. Outbound Admin Reply (Right-aligned Luxury Wine Bubble)
                      return (
                        <div key={m._id} className="flex items-start justify-end gap-2 ml-auto max-w-[85%] sm:max-w-[72%]">
                          <div className="bg-[#881337] text-white p-3 rounded-2xl rounded-tr-sm shadow-xs space-y-1">
                            <span className="text-[10px] font-extrabold text-rose-200 block">
                              {m.sentByAdminName || 'Operator'}
                            </span>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed">
                              {m.content}
                            </p>
                            <div className="flex items-center justify-end gap-1.5 text-[9px] text-rose-200/80 font-mono">
                              <span>{new Date(m.sentAt || m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className={`font-bold ${m.status === 'READ' ? 'text-sky-300' : 'text-rose-200'}`}>
                                {m.status === 'READ' ? '✓✓ Read' : m.status === 'DELIVERED' ? '✓✓ Delivered' : '✓ Sent'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Collapsible Details / Notes Drawer */}
              {showDetailsDrawer && (
                <div className="bg-amber-50/80 border-t border-amber-200 p-3.5 space-y-2.5 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <FileTextIcon className="w-3.5 h-3.5 text-amber-700" />
                      Staff Internal Notes (Confidential)
                    </span>
                    <button
                      onClick={() => setShowDetailsDrawer(false)}
                      className="text-amber-800 hover:text-amber-950 p-1 cursor-pointer"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {notes.length === 0 ? (
                      <span className="text-[11px] text-amber-700 italic block">No internal notes added yet.</span>
                    ) : (
                      notes.map((n, i) => (
                        <div key={n._id || i} className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs shadow-xs">
                          <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold mb-0.5">
                            <span>{n.adminName || 'Admin'}</span>
                            <span className="font-mono">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-800">{n.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddNote} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add staff note for this customer..."
                      className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs focus:outline-none focus:border-amber-600"
                    />
                    <button
                      type="submit"
                      disabled={addingNote || !newNoteText.trim()}
                      className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {addingNote ? 'Saving...' : 'Save Note'}
                    </button>
                  </form>
                </div>
              )}

              {/* Quick Replies Strip */}
              {activeConv.isWindowOpen && (
                <div className="bg-white px-3.5 py-2 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
                  <span className="text-slate-400 font-bold whitespace-nowrap text-[10px]">Quick:</span>
                  {QUICK_REPLIES.map((qr, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setReplyText(qr);
                        textareaRef.current?.focus();
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer border border-slate-200/80"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {/* Message Composer Bar */}
              <div className="p-3 sm:p-3.5 bg-white border-t border-slate-200/80">
                {activeConv.isWindowOpen ? (
                  <form onSubmit={handleSendReply} className="space-y-2">
                    {/* Mode Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setComposerMode('reply')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            composerMode === 'reply' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500'
                          }`}
                        >
                          💬 WhatsApp Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposerMode('note')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            composerMode === 'note' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500'
                          }`}
                        >
                          🔒 Internal Note
                        </button>
                      </div>

                      <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                        Press Enter to send &bull; Shift+Enter for newline
                      </span>
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <textarea
                          ref={textareaRef}
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendReply();
                            }
                          }}
                          placeholder={
                            composerMode === 'reply'
                              ? 'Type a WhatsApp reply to customer...'
                              : 'Write an internal note for staff (not sent to WhatsApp)...'
                          }
                          className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium focus:outline-none resize-none transition-all ${
                            composerMode === 'reply'
                              ? 'bg-slate-50 border border-slate-200/80 text-slate-900 focus:border-rose-500 focus:bg-white'
                              : 'bg-amber-50/50 border border-amber-300 text-amber-950 focus:border-amber-600 focus:bg-white'
                          }`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sendingReply || addingNote || !replyText.trim()}
                        className={`px-4 py-2.5 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                          composerMode === 'reply'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        <MessageSquareIcon className="w-3.5 h-3.5" />
                        <span>
                          {sendingReply || addingNote
                            ? 'Processing...'
                            : composerMode === 'reply'
                            ? 'Send'
                            : 'Save Note'}
                        </span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>24h Window Expired: Select an approved Meta template to message:</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <LuxurySelect
                          value={selectedTemplateKey}
                          onChange={(val) => setSelectedTemplateKey(val)}
                          options={metaTemplates.map((t) => ({
                            value: t.key,
                            label: t.metaName,
                            badge: t.category,
                            sublabel: t.purpose || t.trigger
                          }))}
                          placeholder="Select approved Meta template..."
                          searchable
                          variant="outline"
                          size="sm"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendTemplate}
                        disabled={sendingTemplate}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <span>{sendingTemplate ? 'Sending...' : 'Send Template'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
