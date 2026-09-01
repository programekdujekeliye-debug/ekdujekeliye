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
  MessageCircleIcon,
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
  CheckCircleIcon,
  ShieldCheckIcon,
  MapPinIcon,
  CalendarIcon,
  AwardIcon
} from '../../../components/Icons';
import { LuxurySelect } from '../../../components/LuxurySelect';
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
  // 1. Stats Counter
  const [stats, setStats] = useState({
    totalConversations: 0,
    openCount: 0,
    unreadCount: 0,
    unassignedCount: 0,
    windowExpiringSoonCount: 0
  });

  // 2. Conversations Directory State
  const [conversations, setConversations] = useState<WhatsappConversationItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [loadingConversations, setLoadingConversations] = useState(false);

  // 3. Search & Filters
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'open' | 'window_open' | 'window_expired' | 'closed'>('all');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // 4. Active Chat Thread State
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<WhatsappConversationItem | null>(null);
  const [messages, setMessages] = useState<WhatsappThreadMessage[]>([]);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // 5. Composer & Mode
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('edkl_payment_confirmed_pass_v1');
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // 6. Right-Side Contact Profile Drawer (WhatsApp Web Style)
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // 7. Mobile View State (Master-Detail)
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch Global Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await whatsappApi.getConversationStats();
      if (res.success && res.stats) {
        setStats(res.stats);
      }
    } catch (_) {}
  }, []);

  // Fetch Conversations (Silent background polling)
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

  // Initial Load
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

  // Handle Conversation Selection
  const handleSelectConversation = (conv: WhatsappConversationItem) => {
    setSelectedConvId(conv._id);
    setMobileShowChat(true);
    fetchThreadDetails(conv._id, true);
  };

  // Dispatch Free-Text Reply
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

  // Dispatch Approved Meta Template
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

  // Save Internal Note
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

  // Toggle Case Status (Open / Closed)
  const handleToggleStatus = async () => {
    if (!selectedConvId || !activeConv) return;
    const newStatus = activeConv.status === 'OPEN' ? 'CLOSED' : 'OPEN';

    try {
      await whatsappApi.updateConversationStatus(selectedConvId, newStatus);
      setActiveConv(prev => prev ? { ...prev, status: newStatus } : null);
      setConversations(prev => prev.map(c => c._id === selectedConvId ? { ...c, status: newStatus } : c));
      toast.success(`Case marked as ${newStatus}.`);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
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
    <div className="space-y-3">
      {/* 1. TOP METRICS STRIP */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 ${mobileShowChat ? 'hidden md:grid' : 'grid'}`}>
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Inquiries</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.totalConversations}</div>
          <span className="text-[10px] text-slate-400 font-medium">All live chat threads</span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">Active Open</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">{stats.openCount}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Requiring support</span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs">
          <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            Unread
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mt-0.5">{stats.unreadCount}</div>
          <span className="text-[10px] text-rose-600 font-medium">Awaiting operator reply</span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">Expiring Soon</span>
          <div className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5">{stats.windowExpiringSoonCount}</div>
          <span className="text-[10px] text-amber-700 font-medium">&lt; 2h window left</span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Unassigned</span>
          <div className="text-xl sm:text-2xl font-black text-slate-700 mt-0.5">{stats.unassignedCount}</div>
          <span className="text-[10px] text-slate-400 font-medium">Team claim pool</span>
        </div>
      </div>

      {/* 2. MAIN WHATSAPP WEB STYLE 2-PANE APP CONTAINER */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row h-[calc(100dvh-170px)] md:h-[calc(100vh-210px)] min-h-[580px] max-h-[880px]">
        {/* ========================================================================= */}
        {/* LEFT DIRECTORY PANE (WhatsApp Web Sidebar) */}
        {/* ========================================================================= */}
        <div className={`w-full md:w-[360px] lg:w-[410px] flex flex-col border-r border-slate-200/90 bg-[#FAF9F6] ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Top Bar: Profile / App Header */}
          <div className="p-3 sm:p-3.5 bg-[#F0EBE3] border-b border-slate-200/90 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#881337] text-white flex items-center justify-center font-black text-xs shadow-xs">
                ED
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">WhatsApp Chats</h3>
                <p className="text-[10px] text-slate-500 font-medium">Meta Cloud API &bull; Live</p>
              </div>
            </div>

            <button
              onClick={() => {
                fetchStats();
                fetchConversations(pagination.page);
              }}
              disabled={loadingConversations}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-black/5 rounded-full transition-all cursor-pointer"
              title="Refresh Inquiries"
            >
              <RefreshCwIcon className={`w-4 h-4 ${loadingConversations ? 'animate-spin text-rose-700' : ''}`} />
            </button>
          </div>

          {/* Search Bar & Slot Filter */}
          <div className="p-2.5 bg-white border-b border-slate-200/80 space-y-2">
            <div className="relative">
              <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or start new chat..."
                className="w-full pl-9 pr-3.5 py-1.5 bg-[#F0EBE3]/60 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-rose-500 border border-transparent transition-all placeholder:text-slate-500"
              />
            </div>

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
                variant="subtle"
                size="sm"
              />
            </div>

            {/* Status Filter Chips */}
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
                  className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filter === pill.id
                      ? 'bg-[#881337] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5 space-y-0.5">
            {loadingConversations && conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-700" />
                <span>Loading WhatsApp chats...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-1.5">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <MessageSquareIcon className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-700 block">No conversations found</span>
                <span className="text-[11px] text-slate-400 block max-w-xs mx-auto">
                  When attendees send a message on WhatsApp, it will appear here in real-time.
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
                    className={`p-2.5 sm:p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#EBE5DE] shadow-xs ring-1 ring-black/5'
                        : 'hover:bg-black/5 bg-transparent'
                    }`}
                  >
                    {/* Circle Avatar */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-xs flex-shrink-0 shadow-xs ${
                      conv.unreadCount > 0
                        ? 'bg-[#881337] text-white ring-2 ring-rose-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {initials}
                    </div>

                    {/* Chat Item Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                          {conv.customerName}
                        </span>
                        <span className={`text-[10px] whitespace-nowrap font-medium flex-shrink-0 ${
                          conv.unreadCount > 0 ? 'text-[#881337] font-bold' : 'text-slate-400'
                        }`}>
                          {formatTimeAgo(conv.lastMessageAt)}
                        </span>
                      </div>

                      {/* Phone & Inquiry ID Badge */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
                        <span className="font-mono">{conv.phoneMasked}</span>
                        {conv.inquiryId && (
                          <span className="px-1.5 py-0.2 bg-white border border-slate-200 text-slate-700 rounded font-mono font-bold">
                            {conv.inquiryId}
                          </span>
                        )}
                        {conv.registration?.paymentStatus === 'PAID' && (
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">
                            PAID
                          </span>
                        )}
                      </div>

                      {/* Message Snippet & Unread Badge */}
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {conv.lastMessageDirection === 'OUTBOUND' && <span className="text-slate-400">You: </span>}
                          {conv.lastMessagePreview || 'New inquiry'}
                        </p>

                        {conv.unreadCount > 0 ? (
                          <span className="px-2 py-0.5 bg-[#881337] text-white rounded-full text-[10px] font-black shadow-xs flex-shrink-0">
                            {conv.unreadCount}
                          </span>
                        ) : conv.isWindowOpen ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="24h Window Active" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT CHAT CANVAS (WhatsApp Web Chat Window) */}
        {/* ========================================================================= */}
        <div className={`flex-1 flex flex-col bg-[#EFEAE2] relative ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          {!selectedConvId || !activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FAF9F6]">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 mb-3 shadow-xs">
                <MessageSquareIcon className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-base">WhatsApp Support Workspace</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Select an attendee inquiry from the left to view registration credentials, inspect payment status, and reply directly through Meta WhatsApp Cloud API.
              </p>
            </div>
          ) : (
            <>
              {/* WhatsApp Chat Top Header */}
              <div className="p-3 sm:p-3.5 bg-[#F0EBE3] border-b border-slate-200/90 flex items-center justify-between gap-2 shadow-xs z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden p-1.5 bg-black/5 hover:bg-black/10 text-slate-700 rounded-full text-xs font-bold cursor-pointer"
                  >
                    <span>←</span>
                  </button>

                  <div
                    onClick={() => setShowContactProfile(!showContactProfile)}
                    className="flex items-center gap-2.5 cursor-pointer min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#881337] text-white flex items-center justify-center font-extrabold text-xs shadow-xs flex-shrink-0">
                      {(activeConv.customerName || 'WG').slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate hover:underline">
                          {activeConv.customerName}
                        </h4>
                        <span className="text-xs font-mono text-slate-500 font-bold hidden sm:inline">{activeConv.phoneMasked}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        {activeConv.inquiryId && (
                          <span className="px-1.5 py-0.2 bg-white text-slate-700 font-bold rounded border border-slate-200 font-mono">
                            {activeConv.inquiryId}
                          </span>
                        )}
                        <span className="truncate">{getEventName(activeConv.eventId)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {activeConv.inquiryId && (
                    <a
                      href={`/pass/${activeConv.inquiryId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-slate-200/80 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      title="View Digital Pass"
                    >
                      <TicketIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pass</span>
                    </a>
                  )}

                  {activeConv.inquiryId && onOpenTimeline && (
                    <button
                      onClick={() => onOpenTimeline(activeConv.inquiryId!)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200/80 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      title="View Lifecycle Timeline"
                    >
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Timeline</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowContactProfile(!showContactProfile)}
                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-slate-200/80 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <UsersIcon className="w-3.5 h-3.5 text-amber-700" />
                    <span>Info</span>
                  </button>

                  <button
                    onClick={handleToggleStatus}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                      activeConv.status === 'OPEN'
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                    }`}
                  >
                    {activeConv.status === 'OPEN' ? 'Close' : 'Reopen'}
                  </button>
                </div>
              </div>

              {/* 24-Hour WhatsApp Service Window Banner */}
              <div className={`px-4 py-1.5 text-xs font-bold flex items-center justify-between border-b ${
                activeConv.isWindowOpen
                  ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900'
                  : 'bg-amber-100/70 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${activeConv.isWindowOpen ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
                  <span className="text-[11px] sm:text-xs">
                    {activeConv.isWindowOpen
                      ? `24h Customer Service Window Active (${formatWindowRemaining(activeConv.windowRemainingSeconds)}) — Free-form replies permitted.`
                      : '24h Customer Service Window Expired — Meta requires an approved template to message.'}
                  </span>
                </div>
              </div>

              {/* WhatsApp Messages Canvas */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {loadingDetails ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-700" />
                    Loading WhatsApp thread...
                  </div>
                ) : (
                  <>
                    {messages.map((m) => {
                      const isInbound = m.direction === 'INBOUND';
                      const isAutomation = m.executionSource !== 'ADMIN_REPLY' && m.executionSource !== 'INBOUND_WEBHOOK' && !!m.templateName;

                      // 1. Lifecycle Automation Notification Card (Centered)
                      if (isAutomation) {
                        return (
                          <div key={m._id} className="flex flex-col items-center my-2">
                            <div className="bg-[#FFFDF9] border border-amber-200/80 shadow-xs px-3.5 py-1.5 rounded-2xl max-w-md text-center space-y-0.5">
                              <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
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

                      // 2. Inbound Message from Attendee (Left-aligned WhatsApp White Bubble)
                      if (isInbound) {
                        return (
                          <div key={m._id} className="flex items-start gap-2 max-w-[88%] sm:max-w-[70%]">
                            <div className="bg-white p-3 rounded-2xl rounded-tl-xs shadow-xs space-y-1 border border-slate-200/60">
                              <span className="text-[10px] font-extrabold text-[#881337] block">
                                {activeConv.customerName}
                              </span>
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
                        <div key={m._id} className="flex items-start justify-end gap-2 ml-auto max-w-[88%] sm:max-w-[70%]">
                          <div className="bg-[#881337] text-white p-3 rounded-2xl rounded-tr-xs shadow-xs space-y-1">
                            <span className="text-[10px] font-extrabold text-rose-200 block">
                              {m.sentByAdminName || 'Support Team'}
                            </span>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed text-rose-50">
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

              {/* Quick Replies Bar */}
              {activeConv.isWindowOpen && (
                <div className="bg-[#F0EBE3] px-3.5 py-1.5 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
                  <span className="text-slate-500 font-bold whitespace-nowrap text-[10px]">Quick:</span>
                  {QUICK_REPLIES.map((qr, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setReplyText(qr);
                        textareaRef.current?.focus();
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer border border-slate-200/80 shadow-xs"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {/* WhatsApp Composer Bar */}
              <div className="p-2.5 sm:p-3 bg-[#F0EBE3] border-t border-slate-200/90">
                {activeConv.isWindowOpen ? (
                  <form onSubmit={handleSendReply} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-white/70 p-0.5 rounded-lg text-[10px] font-bold border border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => setComposerMode('reply')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            composerMode === 'reply' ? 'bg-[#881337] text-white shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          💬 WhatsApp Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposerMode('note')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            composerMode === 'note' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          🔒 Internal Note
                        </button>
                      </div>

                      <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                        Enter to send &bull; Shift+Enter for newline
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
                              ? 'Type a message to customer on WhatsApp...'
                              : 'Write an internal operator note (will not be sent to WhatsApp)...'
                          }
                          className={`w-full px-3.5 py-2 rounded-2xl text-xs font-medium focus:outline-none resize-none transition-all ${
                            composerMode === 'reply'
                              ? 'bg-white border border-slate-200 text-slate-900 focus:ring-1 focus:ring-rose-500 shadow-xs'
                              : 'bg-amber-50 border border-amber-300 text-amber-950 focus:ring-1 focus:ring-amber-500 shadow-xs'
                          }`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sendingReply || addingNote || !replyText.trim()}
                        className={`px-4 py-2.5 font-bold text-xs rounded-2xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                          composerMode === 'reply'
                            ? 'bg-[#881337] hover:bg-rose-900 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        <MessageSquareIcon className="w-3.5 h-3.5" />
                        <span>
                          {sendingReply || addingNote
                            ? 'Sending...'
                            : composerMode === 'reply'
                            ? 'Send'
                            : 'Save'}
                        </span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2 bg-amber-50 p-3 rounded-2xl border border-amber-200 shadow-xs">
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
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <span>{sendingTemplate ? 'Sending...' : 'Send Template'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* SLIDE-OUT CONTACT INFO PANEL (WhatsApp Web Contact Drawer) */}
          {/* ========================================================================= */}
          {showContactProfile && activeConv && (
            <div className="absolute inset-y-0 right-0 w-full sm:w-[360px] bg-white border-l border-slate-200/90 shadow-2xl z-20 flex flex-col justify-between">
              {/* Profile Top Bar */}
              <div className="p-3.5 bg-[#F0EBE3] border-b border-slate-200/90 flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-900">Contact & Ticket Details</span>
                <button
                  onClick={() => setShowContactProfile(false)}
                  className="p-1 rounded-full hover:bg-black/5 text-slate-600 cursor-pointer"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* User Avatar & Name */}
                <div className="text-center pb-3 border-b border-slate-100">
                  <div className="w-16 h-16 rounded-full bg-[#881337] text-white flex items-center justify-center font-black text-lg mx-auto mb-2 shadow-xs">
                    {(activeConv.customerName || 'WG').slice(0, 2).toUpperCase()}
                  </div>
                  <h3 className="font-black text-slate-900 text-sm">{activeConv.customerName}</h3>
                  <p className="font-mono text-slate-500 font-bold mt-0.5">{activeConv.phoneMasked}</p>

                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <a
                      href={`https://wa.me/${activeConv.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                    >
                      <MessageCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp Direct</span>
                    </a>
                  </div>
                </div>

                {/* Event & Registration Data */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Inquiry ID</span>
                    <span className="font-mono font-black text-slate-900">{activeConv.inquiryId || 'Not Assigned'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Seminar Slot</span>
                    <span className="font-bold text-slate-800 truncate max-w-[180px]">{getEventName(activeConv.eventId)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Payment Status</span>
                    <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                      activeConv.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {activeConv.paymentStatus === 'PAID' ? 'PAID (₹1,500)' : 'PAYMENT PENDING'}
                    </span>
                  </div>
                </div>

                {/* Quick Pass & Invitation Links */}
                {activeConv.inquiryId && (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`/pass/${activeConv.inquiryId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <TicketIcon className="w-3.5 h-3.5" />
                      <span>VIP Pass</span>
                    </a>

                    <a
                      href={`/invitation/${activeConv.inquiryId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                      <span>Card Link</span>
                    </a>
                  </div>
                )}

                {/* Internal Team Notes Ledger */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-[11px] flex items-center gap-1">
                      <FileTextIcon className="w-3.5 h-3.5 text-amber-600" />
                      Internal Notes ({notes.length})
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {notes.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic block">No staff notes added yet.</span>
                    ) : (
                      notes.map((n, i) => (
                        <div key={n._id || i} className="bg-amber-50/70 p-2 rounded-xl border border-amber-200 text-[11px] shadow-xs">
                          <div className="flex items-center justify-between font-bold text-amber-900 text-[10px] mb-0.5">
                            <span>{n.adminName || 'Admin'}</span>
                            <span className="font-mono text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-800">{n.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddNote} className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add staff note..."
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-600"
                    />
                    <button
                      type="submit"
                      disabled={addingNote || !newNoteText.trim()}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {addingNote ? '...' : 'Add'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Close Drawer Button */}
              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => setShowContactProfile(false)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                >
                  Close Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
