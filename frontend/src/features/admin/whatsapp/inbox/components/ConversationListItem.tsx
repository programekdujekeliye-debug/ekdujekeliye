import React from 'react';
import { WhatsappConversationItem } from '@/services/admin/whatsappApi';

interface ConversationListItemProps {
  conversation: WhatsappConversationItem;
  isSelected: boolean;
  onSelect: (conv: WhatsappConversationItem) => void;
}

export const ConversationListItem: React.FC<ConversationListItemProps> = React.memo(({
  conversation,
  isSelected,
  onSelect
}) => {
  const initials = (conversation.customerName || 'WG')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const formatCompactTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const isWindowActive = conversation.isWindowOpen;

  return (
    <div
      onClick={() => onSelect(conversation)}
      className={`group relative p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all select-none ${
        isSelected
          ? 'bg-rose-50/90 text-slate-900 shadow-2xs border border-rose-200/80 ring-1 ring-[#881337]/20'
          : 'hover:bg-[#FAF9F6] text-slate-700 border border-transparent'
      }`}
    >
      {/* Avatar Container with 24h Window Indicator */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-transform group-hover:scale-105 ${
            conversation.unreadCount > 0
              ? 'bg-gradient-to-br from-[#881337] to-[#BE123C] text-white shadow-xs'
              : isSelected
              ? 'bg-[#881337] text-white'
              : 'bg-slate-200 text-slate-700'
          }`}
        >
          {initials}
        </div>

        {/* 24h Window Pulse Dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            isWindowActive ? 'bg-emerald-500 ring-2 ring-emerald-400/30' : 'bg-slate-300'
          }`}
          title={isWindowActive ? '24h Chat Session Active' : '24h Window Expired'}
        />
      </div>

      {/* Details Preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="font-extrabold text-xs text-slate-900 truncate tracking-tight">
            {conversation.customerName}
          </span>
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap font-mono flex-shrink-0">
            {formatCompactTime(conversation.lastMessageAt)}
          </span>
        </div>

        {/* Token ID Badge & Snippet */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          {conversation.inquiryId && (
            <span className="inline-block px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[9px] flex-shrink-0 border border-slate-200/60">
              {conversation.inquiryId}
            </span>
          )}
          <span className="truncate text-slate-500 text-[11px]">
            {conversation.lastMessageDirection === 'OUTBOUND' && (
              <span className="text-[#881337] mr-1 font-bold">You:</span>
            )}
            {conversation.lastMessagePreview || 'Started conversation'}
          </span>
        </div>
      </div>

      {/* Unread Pill Count */}
      {conversation.unreadCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 bg-[#881337] text-white rounded-full font-black text-[10px] flex items-center justify-center shadow-xs flex-shrink-0 animate-pulse">
          {conversation.unreadCount}
        </span>
      )}
    </div>
  );
});

ConversationListItem.displayName = 'ConversationListItem';
