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
import { Program } from '@/types/event';
import { MetaTemplate } from '@/types/whatsapp';
import {
  MessageSquareIcon,
  RefreshCwIcon,
  SparklesIcon
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
  // 1. Conversations Directory
  const {
    conversations,
    loading: loadingConversations,
    syncing,
    stats,
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
    <div className="flex h-[calc(100vh-80px)] min-h-[500px] max-h-[920px] bg-stone-100 rounded-3xl overflow-hidden border border-stone-200/90 shadow-sm relative">
      {/* ========================================================================= */}
      {/* 1. LEFT PANE: CONVERSATION DIRECTORY SIDEBAR */}
      {/* ========================================================================= */}
      <div
        className={`w-full md:w-[320px] lg:w-[340px] flex-shrink-0 h-full ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatListSidebar
          conversations={conversations}
          selectedConvId={selectedConvId}
          onSelectConversation={handleSelectConversation}
          loading={loadingConversations}
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
        />
      </div>

      {/* ========================================================================= */}
      {/* 2. CENTER PANE: ACTIVE CHAT THREAD CANVAS */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col h-full bg-[#FAF9F6] relative overflow-hidden ${
          !showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConvId && activeConv ? (
          <>
            {/* Header */}
            <ChatThreadHeader
              conversation={activeConv}
              onBackToMobileList={() => setShowMobileChat(false)}
              onToggleInfo={() => setShowContactInfo(!showContactInfo)}
              showInfo={showContactInfo}
              onToggleStatus={toggleStatus}
              eventName={getEventName(activeConv.eventId)}
            />

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2 select-text">
              {loadingThread && messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 space-y-2">
                  <RefreshCwIcon className="w-5 h-5 animate-spin text-rose-600" />
                  <span className="text-xs font-medium">Loading WhatsApp messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-300">
                    <MessageSquareIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-stone-600">No messages in this conversation yet.</p>
                  <p className="text-[11px] text-stone-400 max-w-xs text-center">
                    Type a message below to start chatting with {activeConv.customerName}.
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
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-stone-200/60 flex items-center justify-center text-stone-400 shadow-2xs">
              <MessageSquareIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-stone-800 tracking-tight">
              Ek Duje Ke Liye WhatsApp Center
            </h3>
            <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
              Select any conversation from the list to view real-time chat history, delivery ticks, and reply directly.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                + Start / Search Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT PANE: ATTENDEE DOSSIER DRAWER */}
      {/* ========================================================================= */}
      {selectedConvId && activeConv && showContactInfo && (
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
