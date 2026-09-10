import React, { useState, useRef, useEffect } from 'react';
import { useWhatsAppConversations } from './hooks/useWhatsAppConversations';
import { useWhatsAppThread } from './hooks/useWhatsAppThread';
import { ChatListSidebar } from './components/ChatListSidebar';
import { ChatThreadHeader } from './components/ChatThreadHeader';
import { MessageBubble } from './components/MessageBubble';
import { ChatComposer } from './components/ChatComposer';
import { TemplateSelectorModal } from './components/TemplateSelectorModal';
import { ContactDetailsDrawer } from './components/ContactDetailsDrawer';
import { NewChatModal } from './components/NewChatModal';
import { DevSimulatorModal } from './components/DevSimulatorModal';
import { Program } from '@/types/event';
import { MetaTemplate } from '@/types/whatsapp';
import {
  MessageSquareIcon,
  RefreshCwIcon
} from '@/components/Icons';

interface WhatsAppInboxContainerProps {
  events: Program[];
  metaTemplates: MetaTemplate[];
  onOpenTimeline?: (inquiryId: string) => void;
}

export const WhatsAppInboxContainer: React.FC<WhatsAppInboxContainerProps> = ({
  events,
  metaTemplates,
  onOpenTimeline
}) => {
  // 1. Conversations Directory State
  const {
    conversations,
    loading: loadingConversations,
    loadingMore,
    hasMore,
    loadMore,
    syncing,
    stats,
    pagination,
    filters,
    setFilters,
    refresh: refreshConversations,
    syncHistorical,
    checkOrCreatePhone
  } = useWhatsAppConversations();

  // 2. Active Selection State
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);

  // 3. Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // 4. Thread Manager Hook
  const {
    activeConv,
    messages,
    notes,
    loading: loadingThread,
    sendingReply,
    sendingTemplate,
    addingNote,
    sendReply,
    sendTemplate,
    addNote,
    toggleStatus,
    refreshThread
  } = useWhatsAppThread(selectedConvId, refreshConversations);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Chat Selection
  const handleSelectConversation = (conv: any) => {
    setSelectedConvId(conv._id);
    setShowMobileChat(true);
  };

  // Helper to resolve event name
  const getEventName = (eventId?: string) => {
    if (!eventId) return undefined;
    const evt = events.find(e => e.id === eventId || (e as any)._id === eventId);
    return evt ? `${evt.name} — ${evt.date || 'TBA'}` : undefined;
  };

  return (
    <div className="space-y-3 w-full">
      {/* ========================================================================= */}
      {/* 1. TOP METRICS STRIP: DESKTOP 5-CARD GRID & MOBILE INTERACTIVE PILL STRIP */}
      {/* ========================================================================= */}
      
      {/* Mobile Horizontal Pill Ribbon (< md) */}
      <div className={`md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none ${showMobileChat ? 'hidden' : 'flex'}`}>
        <button
          type="button"
          onClick={() => setFilters(prev => ({ ...prev, filter: 'all' }))}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-2xs flex items-center gap-1.5 cursor-pointer ${
            filters.filter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>All Chats</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-800 text-[10px] font-black">
            {stats.totalConversations}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilters(prev => ({ ...prev, filter: 'open' }))}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-2xs flex items-center gap-1.5 cursor-pointer ${
            filters.filter === 'open'
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Active Open</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white text-emerald-800 text-[10px] font-black shadow-2xs">
            {stats.openCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilters(prev => ({ ...prev, filter: 'unread' }))}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-2xs flex items-center gap-1.5 cursor-pointer ${
            filters.filter === 'unread'
              ? 'bg-rose-700 text-white border-rose-700'
              : stats.unreadCount > 0
              ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {stats.unreadCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />}
          <span>Unread</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white text-rose-800 text-[10px] font-black shadow-2xs">
            {stats.unreadCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilters(prev => ({ ...prev, filter: 'window_expiring_soon' }))}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-2xs flex items-center gap-1.5 cursor-pointer ${
            filters.filter === 'window_expiring_soon'
              ? 'bg-amber-700 text-white border-amber-700'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <span>&lt; 2h Window</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white text-amber-900 text-[10px] font-black shadow-2xs">
            {stats.windowExpiringSoonCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilters(prev => ({ ...prev, filter: 'unassigned' }))}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-2xs flex items-center gap-1.5 cursor-pointer ${
            filters.filter === 'unassigned'
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Unassigned</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-800 text-[10px] font-black">
            {stats.unassignedCount}
          </span>
        </button>
      </div>

      {/* Desktop 5 Interactive KPI Cards (>= md) */}
      <div className="hidden md:grid grid-cols-5 gap-3">
        <div
          onClick={() => setFilters(prev => ({ ...prev, filter: 'all' }))}
          className={`p-3.5 rounded-2xl border transition-all shadow-xs cursor-pointer select-none ${
            filters.filter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20'
              : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-900'
          }`}
        >
          <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${filters.filter === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
            Total Inquiries
          </span>
          <div className="text-2xl font-black mt-0.5">{stats.totalConversations}</div>
          <span className={`text-[10px] font-medium ${filters.filter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
            All directory contacts
          </span>
        </div>

        <div
          onClick={() => setFilters(prev => ({ ...prev, filter: 'open' }))}
          className={`p-3.5 rounded-2xl border transition-all shadow-xs cursor-pointer select-none ${
            filters.filter === 'open'
              ? 'bg-emerald-800 text-white border-emerald-800 ring-2 ring-emerald-600/30'
              : 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200 text-emerald-900'
          }`}
        >
          <span className={`text-[10px] font-extrabold uppercase tracking-wider block flex items-center gap-1.5 ${filters.filter === 'open' ? 'text-emerald-200' : 'text-emerald-700'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active Open
          </span>
          <div className="text-2xl font-black mt-0.5">{stats.openCount}</div>
          <span className={`text-[10px] font-medium ${filters.filter === 'open' ? 'text-emerald-200' : 'text-emerald-700'}`}>
            Requiring support
          </span>
        </div>

        <div
          onClick={() => setFilters(prev => ({ ...prev, filter: 'unread' }))}
          className={`p-3.5 rounded-2xl border transition-all shadow-xs cursor-pointer select-none ${
            filters.filter === 'unread'
              ? 'bg-rose-800 text-white border-rose-800 ring-2 ring-rose-600/30'
              : 'bg-rose-50/40 hover:bg-rose-50/80 border-rose-200 text-rose-900'
          }`}
        >
          <span className={`text-[10px] font-extrabold uppercase tracking-wider block flex items-center gap-1.5 ${filters.filter === 'unread' ? 'text-rose-200' : 'text-rose-700'}`}>
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            Unread
          </span>
          <div className="text-2xl font-black mt-0.5">{stats.unreadCount}</div>
          <span className={`text-[10px] font-medium ${filters.filter === 'unread' ? 'text-rose-200' : 'text-rose-700'}`}>
            Awaiting operator reply
          </span>
        </div>

        <div
          onClick={() => setFilters(prev => ({ ...prev, filter: 'window_expiring_soon' }))}
          className={`p-3.5 rounded-2xl border transition-all shadow-xs cursor-pointer select-none ${
            filters.filter === 'window_expiring_soon'
              ? 'bg-amber-800 text-white border-amber-800 ring-2 ring-amber-600/30'
              : 'bg-amber-50/30 hover:bg-amber-50/70 border-amber-200 text-amber-900'
          }`}
        >
          <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${filters.filter === 'window_expiring_soon' ? 'text-amber-200' : 'text-amber-700'}`}>
            Expiring Soon
          </span>
          <div className="text-2xl font-black mt-0.5">{stats.windowExpiringSoonCount}</div>
          <span className={`text-[10px] font-medium ${filters.filter === 'window_expiring_soon' ? 'text-amber-200' : 'text-amber-700'}`}>
            &lt; 2h window left
          </span>
        </div>

        <div
          onClick={() => setFilters(prev => ({ ...prev, filter: 'unassigned' }))}
          className={`p-3.5 rounded-2xl border transition-all shadow-xs cursor-pointer select-none ${
            filters.filter === 'unassigned'
              ? 'bg-slate-800 text-white border-slate-800 ring-2 ring-slate-600/30'
              : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800'
          }`}
        >
          <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${filters.filter === 'unassigned' ? 'text-slate-300' : 'text-slate-400'}`}>
            Unassigned
          </span>
          <div className="text-2xl font-black mt-0.5">{stats.unassignedCount}</div>
          <span className={`text-[10px] font-medium ${filters.filter === 'unassigned' ? 'text-slate-300' : 'text-slate-500'}`}>
            Team claim pool
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WHATSAPP 2-PANE APP CONTAINER (WITH ZERO-COLLISION MOBILE VIEW) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row h-[calc(100dvh-170px)] md:h-[calc(100vh-210px)] md:min-h-[640px] md:max-h-[920px]">
        {/* ========================================================================= */}
        {/* LEFT DIRECTORY PANE (WhatsApp Web Sidebar) */}
        {/* ========================================================================= */}
        <div className={`w-full md:w-[370px] lg:w-[410px] flex flex-col border-r border-slate-200/90 bg-[#FAF9F6] flex-shrink-0 h-full ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
          <ChatListSidebar
            conversations={conversations}
            selectedConvId={selectedConvId}
            onSelectConversation={handleSelectConversation}
            loading={loadingConversations}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            syncing={syncing}
            events={events}
            search={filters.search}
            onSearchChange={val => setFilters(prev => ({ ...prev, search: val }))}
            filter={filters.filter}
            onFilterChange={val => setFilters(prev => ({ ...prev, filter: val }))}
            selectedEventId={filters.selectedEventId}
            onEventChange={val => setFilters(prev => ({ ...prev, selectedEventId: val }))}
            onNewChatClick={() => setShowNewChatModal(true)}
            onSyncHistorical={syncHistorical}
            onRefresh={refreshConversations}
            unreadTotal={stats.unreadCount}
            openTotal={stats.openCount}
            totalChats={pagination.total}
          />
        </div>

        {/* ========================================================================= */}
        {/* RIGHT CHAT PANE (Full-Screen on Mobile when Chat Opened, 2-Pane on Desktop) */}
        {/* ========================================================================= */}
        <div className={`flex-1 flex flex-col bg-[#F0EBE3] relative overflow-hidden min-w-0 ${
          showMobileChat
            ? 'fixed inset-0 z-50 flex flex-col bg-[#F0EBE3] md:relative md:inset-auto md:z-auto md:flex'
            : 'hidden md:flex'
        }`}>
          {selectedConvId && activeConv ? (
            <>
              {/* Top Bar Header */}
              <ChatThreadHeader
                conversation={activeConv}
                onBackToMobileList={() => setShowMobileChat(false)}
                onOpenInfo={() => setShowContactInfo(true)}
                onToggleStatus={toggleStatus}
                eventName={getEventName(activeConv.eventId)}
              />

              {/* Messages Canvas */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 select-text w-full">
                {loadingThread && messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                    <RefreshCwIcon className="w-5 h-5 animate-spin text-rose-700" />
                    <span className="text-xs font-medium">Loading WhatsApp thread...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center text-slate-300 shadow-2xs">
                      <MessageSquareIcon className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-600">No message history yet with this contact.</p>
                    <p className="text-[11px] text-slate-400 max-w-xs text-center">
                      Send a message below or use an approved template to contact this attendee.
                    </p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg._id}
                      message={msg}
                      customerName={activeConv.customerName}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <ChatComposer
                isWindowActive={activeConv.isWindowOpen}
                onSendReply={sendReply}
                onAddNote={addNote}
                onOpenTemplateModal={() => setShowTemplateModal(true)}
                sendingReply={sendingReply}
                addingNote={addingNote}
              />
            </>
          ) : (
            /* Empty State when no conversation is selected */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-white/70 flex items-center justify-center text-slate-400 shadow-2xs">
                <MessageSquareIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">
                WhatsApp Support Command Center
              </h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Select any conversation on the left to read messages, view delivery receipts, and chat live with attendees.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="px-4 py-2 bg-[#881337] hover:bg-rose-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  + Start / Search Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SLIDE-OVER ATTENDEE DOSSIER DRAWER (MODAL OVERLAY - ZERO COLLISION) */}
      {/* ========================================================================= */}
      {selectedConvId && activeConv && (
        <ContactDetailsDrawer
          isOpen={showContactInfo}
          onClose={() => setShowContactInfo(false)}
          conversation={activeConv}
          notes={notes}
          eventName={getEventName(activeConv.eventId)}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS */}
      {/* ========================================================================= */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onOpenPhone={checkOrCreatePhone}
        onSelectConversationId={id => {
          setSelectedConvId(id);
          setShowMobileChat(true);
        }}
      />

      <DevSimulatorModal
        isOpen={showSimulatorModal}
        onClose={() => setShowSimulatorModal(false)}
        defaultPhone={activeConv?.phone || '8320594829'}
        onSimulated={() => {
          refreshConversations();
          if (selectedConvId) refreshThread();
        }}
      />

      {activeConv && (
        <TemplateSelectorModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          metaTemplates={metaTemplates}
          customerName={activeConv.customerName}
          onSendTemplate={tplKey => sendTemplate(tplKey)}
          sending={sendingTemplate}
        />
      )}
    </div>
  );
};
