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
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const photoUrl =
    conversation.couplePhoto ||
    conversation.registration?.couplePhoto ||
    (conversation.registrationId as any)?.couplePhoto ||
    null;

  return (
    <div
      onClick={() => onSelect(conversation)}
      className={`group relative p-2.5 sm:p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all select-none ${
        isSelected
          ? 'bg-[#EBE5DE] text-slate-900 shadow-2xs'
          : 'hover:bg-black/5 text-slate-800'
      }`}
    >
      {/* Visible DP Photo / Initials Avatar */}
      <WhatsAppAvatar
        name={conversation.customerName}
        photoUrl={photoUrl}
        size="md"
        isWindowActive={isWindowActive}
      />

      {/* Middle Text Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
            {conversation.customerName}
          </span>
          <span className="text-[10px] text-slate-500 flex-shrink-0 font-medium">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] text-slate-600 truncate max-w-[190px] sm:max-w-[210px]">
            {conversation.lastMessagePreview || 'No messages yet'}
          </p>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Inquiry Token Badge */}
            {conversation.inquiryId && (
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/80 text-slate-700 rounded border border-slate-200">
                {conversation.inquiryId}
              </span>
            )}

            {/* Unread Pill */}
            {conversation.unreadCount > 0 && (
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
