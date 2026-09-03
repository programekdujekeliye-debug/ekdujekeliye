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
  XIcon
} from '@/components/Icons';

interface ChatListSidebarProps {
  conversations: WhatsappConversationItem[];
  selectedConvId: string | null;
  onSelectConversation: (conv: WhatsappConversationItem) => void;
  loading: boolean;
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
}

export const ChatListSidebar: React.FC<ChatListSidebarProps> = ({
  conversations,
  selectedConvId,
  onSelectConversation,
  loading,
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
  unreadTotal
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
    <div className="flex flex-col h-full w-full bg-white select-none overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-3.5 border-b border-slate-200/80 bg-[#FAF9F6] flex items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <span>Conversations</span>
            {unreadTotal > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#881337] text-white font-extrabold text-[10px] animate-pulse">
                {unreadTotal}
              </span>
            )}
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">WhatsApp Live Ledger</p>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Refresh Chats"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#881337]' : ''}`} />
          </button>

          {/* Sync Button */}
          <button
            type="button"
            onClick={onSyncHistorical}
            disabled={syncing}
            className="px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer text-[10px] font-bold"
            title="Sync all previous messages"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>

          {/* Start New Chat Button */}
          <button
            type="button"
            onClick={onNewChatClick}
            className="px-2.5 py-1.5 rounded-xl bg-[#881337] hover:bg-[#9F1239] text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Search & Seminar Slot Filter */}
      <div className="p-3 bg-white border-b border-slate-200/70 space-y-2 flex-shrink-0">
        {/* Search Box */}
        <div className="relative">
          <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search name, phone, token..."
            className="w-full pl-8 pr-8 py-1.5 bg-[#FAF9F6] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#881337] border border-slate-200/70 transition-all placeholder:text-slate-400"
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

        {/* Global LuxurySelect for Seminar Slot */}
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

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[10px]">
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

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <RefreshCwIcon className="w-4 h-4 mx-auto animate-spin text-[#881337]" />
            <span>Loading WhatsApp chats...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <MessageSquareIcon className="w-4 h-4" />
            </div>
            <p className="font-bold text-slate-700">No conversations found</p>
            <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
              Click <strong>&quot;+ New&quot;</strong> to start a chat with any number, or click Sync.
            </p>
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationListItem
              key={conv._id}
              conversation={conv}
              isSelected={selectedConvId === conv._id}
              onSelect={onSelectConversation}
            />
          ))
        )}
      </div>
    </div>
  );
};
