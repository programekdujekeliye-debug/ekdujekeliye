import React from 'react';
import { WhatsappConversationItem } from '@/services/admin/whatsappApi';
import { Program } from '@/types/event';
import { ConversationListItem } from './ConversationListItem';
import { LuxurySelect } from '@/components/LuxurySelect';
import {
  SearchIcon,
  RefreshCwIcon,
  PlusIcon,
  MessageSquareIcon,
  XIcon,
  ActivityIcon
} from '@/components/Icons';

interface ChatListSidebarProps {
  conversations: WhatsappConversationItem[];
  selectedConvId: string | null;
  onSelectConversation: (conv: WhatsappConversationItem) => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  syncing: boolean;
  events: Program[];
  search: string;
  onSearchChange: (search: string) => void;
  filter: 'all' | 'unread' | 'inbound' | 'open' | 'window_open' | 'window_expired' | 'closed';
  onFilterChange: (filter: 'all' | 'unread' | 'inbound' | 'open' | 'window_open' | 'window_expired' | 'closed') => void;
  selectedEventId: string;
  onEventChange: (eventId: string) => void;
  onNewChatClick: () => void;
  onSyncHistorical: () => void;
  onRefresh: () => void;
  unreadTotal: number;
  totalChats: number;
}

export const ChatListSidebar: React.FC<ChatListSidebarProps> = ({
  conversations,
  selectedConvId,
  onSelectConversation,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  syncing,
  events,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  selectedEventId,
  onEventChange,
  onNewChatClick,
  onSyncHistorical,
  onRefresh,
  unreadTotal,
  totalChats
}) => {
  const eventSelectOptions = [
    { value: 'all', label: 'All Inquiries & Events' },
    { value: 'leads', label: 'General & Marketing Replies' },
    ...events.map(evt => ({
      value: evt.id || (evt as any)._id,
      label: evt.name,
      badge: evt.date || 'TBA',
      sublabel: evt.venue
    }))
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#FAF9F6] border-r border-stone-200 select-none overflow-hidden">
      {/* Top Bar: Profile & Action Controls */}
      <div className="p-3 sm:p-3.5 bg-[#F5F2EB] border-b border-stone-200 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#881337] text-white flex items-center justify-center font-black text-xs shadow-xs">
            ED
          </div>
          <div>
            <h3 className="font-extrabold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
              <span>Support Inbox</span>
              {unreadTotal > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#881337] text-white font-extrabold text-[10px] animate-pulse">
                  {unreadTotal}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-stone-500 font-medium">Meta WhatsApp Live 2-Way Chat</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Check Number / Start New Chat */}
          <button
            type="button"
            onClick={onNewChatClick}
            className="px-2.5 py-1.5 bg-[#881337] hover:bg-[#70102d] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            title="Start Chat / Check Number"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          {/* Sync All Messages */}
          <button
            type="button"
            onClick={onSyncHistorical}
            disabled={syncing}
            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-all cursor-pointer"
            title="Sync & Link Conversations"
          >
            <ActivityIcon className={`w-4 h-4 ${syncing ? 'animate-spin text-[#881337]' : ''}`} />
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-all cursor-pointer"
            title="Refresh Inbox"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin text-[#881337]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar & Slot Filter */}
      <div className="p-2.5 bg-white border-b border-stone-200 space-y-2 flex-shrink-0">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search name, mobile (e.g. 98251...)..."
            className="w-full pl-9 pr-8 py-2 bg-[#FAF9F6] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#881337] border border-stone-200 transition-all placeholder:text-stone-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Seminar Slot Filter */}
        <div className="w-full">
          <LuxurySelect
            value={selectedEventId}
            onChange={val => onEventChange(val)}
            options={eventSelectOptions}
            placeholder="Filter by Seminar Slot..."
            searchable
            variant="subtle"
            size="sm"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
          {[
            { id: 'unread', label: `Unread (${unreadTotal})`, highlight: unreadTotal > 0 },
            { id: 'all', label: `All (${totalChats})` },
            { id: 'inbound', label: 'Inbound Replies' },
            { id: 'window_open', label: '24h Active' },
            { id: 'closed', label: 'Resolved' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => onFilterChange(chip.id as any)}
              className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === chip.id
                  ? 'bg-[#881337] text-white shadow-xs'
                  : chip.highlight
                  ? 'bg-rose-50 text-[#881337] border border-rose-200 hover:bg-rose-100'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* WhatsApp Conversations Scroll List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading && conversations.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs space-y-2">
            <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin text-[#881337]" />
            <span>Loading WhatsApp conversations...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
              <MessageSquareIcon className="w-5 h-5" />
            </div>
            <p className="font-bold text-stone-700">No conversations in this view</p>
            <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
              Select <strong>&quot;All Inquiries &amp; Events&quot;</strong> or click <strong>&quot;+ New Chat&quot;</strong> to search any number.
            </p>
          </div>
        ) : (
          <>
            {conversations.map(conv => (
              <ConversationListItem
                key={conv._id}
                conversation={conv}
                isSelected={selectedConvId === conv._id}
                onSelect={onSelectConversation}
              />
            ))}

            {/* Load More Historical Chats */}
            {hasMore && (
              <div className="pt-2 pb-3 px-1 text-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2 bg-white hover:bg-stone-50 text-stone-700 rounded-xl font-bold text-xs border border-stone-200 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCwIcon className="w-3.5 h-3.5 animate-spin text-[#881337]" />
                      <span>Loading more conversations...</span>
                    </>
                  ) : (
                    <span>Load More (Showing {conversations.length} of {totalChats})</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
