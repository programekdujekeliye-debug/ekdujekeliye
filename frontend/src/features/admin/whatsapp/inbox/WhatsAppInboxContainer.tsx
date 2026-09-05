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
      {/* 1. TOP METRICS STRIP (THE AUTHENTIC 5 STAT CARDS) */}
      {/* ========================================================================= */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 ${showMobileChat ? 'hidden md:grid' : 'grid'}`}>
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Inquiries</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.totalConversations}</div>
          <span className="text-[10px] text-slate-400 font-medium">All historical chats</span>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
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

      {/* ========================================================================= */}
      {/* 2. MAIN WHATSAPP WEB STYLE 2-PANE APP CONTAINER */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row h-[calc(100dvh-170px)] md:h-[calc(100vh-210px)] min-h-[600px] max-h-[920px]">
        {/* ========================================================================= */}
        {/* LEFT DIRECTORY PANE (WhatsApp Web Sidebar) */}
        {/* ========================================================================= */}
        <div className={`w-full md:w-[370px] lg:w-[420px] flex flex-col border-r border-slate-200/90 bg-[#FAF9F6] flex-shrink-0 ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
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
            totalChats={pagination.total}
          />
        </div>

        {/* ========================================================================= */}
        {/* RIGHT CHAT PANE (WhatsApp Web Chat Canvas) */}
        {/* ========================================================================= */}
        <div className={`flex-1 flex flex-col bg-[#F0EBE3] relative overflow-hidden min-w-0 ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
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
