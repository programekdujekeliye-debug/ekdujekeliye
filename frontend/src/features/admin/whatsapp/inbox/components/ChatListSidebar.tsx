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
  filter: 'all' | 'unread' | 'open' | 'window_open' | 'window_expired' | 'closed';
  onFilterChange: (filter: 'all' | 'unread' | 'open' | 'window_open' | 'window_expired' | 'closed') => void;
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
    { value: 'all', label: 'All Seminar Slots' },
    ...events.map(evt => ({
      value: evt.id || (evt as any)._id,
      label: evt.name,
      badge: evt.date || 'TBA',
      sublabel: evt.venue
    }))
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#FAF9F6] border-r border-slate-200/90 select-none overflow-hidden">
      {/* Top Bar: Profile & Header */}
      <div className="p-3 sm:p-3.5 bg-[#F0EBE3] border-b border-slate-200/90 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#881337] text-white flex items-center justify-center font-black text-xs shadow-xs">
            ED
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
              <span>WhatsApp Chats</span>
              {unreadTotal > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#881337] text-white font-extrabold text-[10px] animate-pulse">
                  {unreadTotal}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Meta Cloud API &bull; 2-Way Live</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Check Number / Start New Chat */}
          <button
            type="button"
            onClick={onNewChatClick}
            className="px-2.5 py-1.5 bg-[#881337] hover:bg-rose-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            title="Start Chat / Check Number"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          {/* Sync All Old Messages */}
          <button
            type="button"
            onClick={onSyncHistorical}
            disabled={syncing}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-black/5 rounded-full transition-all cursor-pointer"
            title="Sync All Old Messages & Link History"
          >
            <ActivityIcon className={`w-4 h-4 ${syncing ? 'animate-spin text-rose-700' : ''}`} />
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-black/5 rounded-full transition-all cursor-pointer"
            title="Refresh Inbox"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin text-rose-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar & Slot Filter */}
      <div className="p-2.5 bg-white border-b border-slate-200/80 space-y-2 flex-shrink-0">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search name, phone (e.g. 8320594829)..."
            className="w-full pl-9 pr-8 py-1.5 bg-[#F0EBE3]/60 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-rose-500 border border-transparent transition-all placeholder:text-slate-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
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
            { id: 'all', label: 'All' },
            { id: 'unread', label: `Unread (${unreadTotal})` },
            { id: 'open', label: 'Open' },
            { id: 'window_open', label: '24h Active' },
            { id: 'closed', label: 'Closed' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => onFilterChange(chip.id as any)}
              className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === chip.id
                  ? 'bg-[#881337] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* WhatsApp Conversations Scroll List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5 space-y-0.5">
        {loading && conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin text-rose-700" />
            <span>Loading WhatsApp chats...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <MessageSquareIcon className="w-5 h-5" />
            </div>
            <p className="font-bold text-slate-700">No conversations found</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Click <strong>&quot;+ New&quot;</strong> above to check or message any number, or click Sync.
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
              <div className="pt-2 pb-3 px-2 text-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs border border-slate-200/80 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCwIcon className="w-3.5 h-3.5 animate-spin text-rose-700" />
                      <span>Loading more chats...</span>
                    </>
                  ) : (
                    <span>Load More Chats (Showing {conversations.length} of {totalChats})</span>
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
