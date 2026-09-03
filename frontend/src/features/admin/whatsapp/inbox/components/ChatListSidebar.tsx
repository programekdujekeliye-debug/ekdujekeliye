import React from 'react';
import {
  WhatsappConversationItem
} from '@/services/admin/whatsappApi';
import { Program } from '@/types/event';
import { ConversationListItem } from './ConversationListItem';
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
  return (
    <div className="flex flex-col h-full bg-white border-r border-stone-200/90 select-none">
      {/* Top Header Bar */}
      <div className="p-3.5 border-b border-stone-200/80 bg-stone-50/50 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-1.5">
            <span>Support Inbox</span>
            {unreadTotal > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-extrabold text-[10px]">
                {unreadTotal}
              </span>
            )}
          </h2>
          <p className="text-[10px] text-stone-500 font-medium">Live WhatsApp Chats</p>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
            title="Refresh Chats"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-600' : ''}`} />
          </button>

          {/* Sync Button */}
          <button
            type="button"
            onClick={onSyncHistorical}
            disabled={syncing}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1"
            title="Sync all previous records"
          >
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* Start New Chat Button */}
          <button
            type="button"
            onClick={onNewChatClick}
            className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Search & Seminar Slot Filter */}
      <div className="p-2.5 bg-white border-b border-stone-200/70 space-y-2">
        {/* Search Box */}
        <div className="relative">
          <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search couple, phone, token..."
            className="w-full pl-8 pr-8 py-1.5 bg-stone-100/80 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-rose-500 border border-transparent transition-all placeholder:text-stone-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Event Slot Selector */}
        <div className="w-full">
          <select
            value={selectedEventId}
            onChange={e => onEventChange(e.target.value)}
            className="w-full px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-xl text-[11px] font-semibold text-stone-700 focus:outline-none focus:border-rose-500 truncate"
          >
            <option value="all">All Seminar Slots</option>
            {events.map(evt => (
              <option key={evt.id || (evt as any)._id} value={evt.id || (evt as any)._id}>
                {evt.name} ({evt.date || 'TBA'})
              </option>
            ))}
          </select>
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
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {loading && conversations.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs space-y-2">
            <RefreshCwIcon className="w-4 h-4 mx-auto animate-spin text-rose-600" />
            <span>Loading WhatsApp chats...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
              <MessageSquareIcon className="w-4 h-4" />
            </div>
            <p className="font-bold text-stone-700">No chats found</p>
            <p className="text-[11px] text-stone-400 max-w-[200px] mx-auto">
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
