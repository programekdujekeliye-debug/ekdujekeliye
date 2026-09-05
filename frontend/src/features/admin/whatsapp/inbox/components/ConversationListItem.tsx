import React from 'react';
import { WhatsappConversationItem } from '@/services/admin/whatsappApi';
import { WhatsAppAvatar } from './WhatsAppAvatar';

interface ConversationListItemProps {
  conversation: WhatsappConversationItem;
  isSelected: boolean;
  onSelect: (conversation: WhatsappConversationItem) => void;
}

export const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isSelected,
  onSelect
}) => {
  const isWindowActive = conversation.isWindowOpen;

  // Format phone display nicely
  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
    }
    if (clean.length === 10) {
      return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    }
    return phone;
  };

  // Display Name: Attendee Name or formatted phone
  const displayName =
    conversation.customerName &&
    conversation.customerName !== 'WhatsApp Guest' &&
    !conversation.customerName.startsWith('91') &&
    !conversation.customerName.includes('*')
      ? conversation.customerName
      : formatPhone(conversation.phone);

  // Format relative timestamp
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const photoUrl =
    conversation.couplePhoto ||
    conversation.registration?.couplePhoto ||
    (conversation.registrationId as any)?.couplePhoto ||
    null;

  const isOutbound = conversation.lastMessageDirection === 'OUTBOUND';
  const hasUnread = (conversation.unreadCount || 0) > 0;

  // Event badge label
  const getEventBadge = () => {
    if (conversation.eventId === 'prog-2026-09-07') return '7 Sept';
    if (conversation.eventId === 'prog-2026-09-11') return '11 Sept';
    if (conversation.eventId === 'prog-2026-09-19') return '19 Sept';
    if (conversation.inquiryId) return conversation.inquiryId;
    return null;
  };

  const eventBadge = getEventBadge();

  return (
    <div
      onClick={() => onSelect(conversation)}
      className={`group relative p-2.5 sm:p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all select-none border ${
        isSelected
          ? 'bg-[#EFE9E1] border-[#881337]/30 text-slate-900 shadow-2xs'
          : hasUnread
          ? 'bg-rose-50/40 hover:bg-rose-50/70 border-rose-100 text-slate-900'
          : 'bg-white hover:bg-stone-50 border-stone-200/60 text-slate-800'
      }`}
    >
      {/* Visible DP Photo / Initials Avatar */}
      <WhatsAppAvatar
        name={displayName}
        photoUrl={photoUrl}
        size="md"
        isWindowActive={isWindowActive}
      />

      {/* Middle Text Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className={`font-bold text-xs sm:text-sm truncate ${hasUnread ? 'text-[#881337] font-black' : 'text-slate-900'}`}>
            {displayName}
          </span>
          <span className={`text-[10px] flex-shrink-0 font-medium ${hasUnread ? 'text-[#881337] font-bold' : 'text-slate-500'}`}>
            {formatTime(conversation.lastMessageAt || conversation.lastInboundAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1">
          <p className={`text-[11px] truncate max-w-[190px] sm:max-w-[210px] ${hasUnread ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
            {isOutbound && <span className="text-slate-400 font-normal mr-1">You:</span>}
            {conversation.lastMessagePreview || 'No messages yet'}
          </p>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Event or Token Badge */}
            {eventBadge && (
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-stone-100 text-stone-700 rounded border border-stone-200">
                {eventBadge}
              </span>
            )}

            {/* Unread Pill */}
            {hasUnread && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#881337] text-white font-extrabold text-[10px] min-w-[18px] text-center shadow-xs">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
