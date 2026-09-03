import React from 'react';
import { WhatsappConversationItem } from '@/services/admin/whatsappApi';
import {
  ChevronLeftIcon,
  TicketIcon,
  UsersIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from '@/components/Icons';

interface ChatThreadHeaderProps {
  conversation: WhatsappConversationItem;
  onBackToMobileList: () => void;
  onToggleInfo: () => void;
  showInfo: boolean;
  onToggleStatus: () => void;
  eventName?: string;
}

export const ChatThreadHeader: React.FC<ChatThreadHeaderProps> = ({
  conversation,
  onBackToMobileList,
  onToggleInfo,
  showInfo,
  onToggleStatus,
  eventName
}) => {
  const initials = (conversation.customerName || 'WG')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isWindowActive = conversation.isWindowOpen;

  // Format remaining time nicely
  const formatTimeLeft = (sec?: number) => {
    if (!sec || sec <= 0) return 'Expired';
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  return (
    <div className="bg-white border-b border-stone-200/80 select-none">
      {/* Primary Header Row */}
      <div className="p-3 sm:px-4 flex items-center justify-between gap-2">
        {/* Left: Mobile Back Button + Avatar + Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile back arrow */}
          <button
            type="button"
            onClick={onBackToMobileList}
            className="md:hidden p-1.5 -ml-1 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 cursor-pointer"
            aria-label="Back to chats"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-800 to-stone-900 text-white flex items-center justify-center font-black text-xs flex-shrink-0 shadow-xs">
            {initials}
          </div>

          {/* Couple Name & Meta */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-stone-900 text-xs sm:text-sm truncate">
                {conversation.customerName}
              </h3>
              <span className="text-[11px] font-mono text-stone-400 font-bold hidden sm:inline">
                {conversation.phoneMasked}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-stone-500 truncate">
              {conversation.inquiryId && (
                <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-800 font-mono font-bold text-[9px] border border-stone-200 flex-shrink-0">
                  {conversation.inquiryId}
                </span>
              )}
              <span className="truncate">{eventName || 'Seminar Attendee'}</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Digital Pass Quick Link */}
          {conversation.inquiryId && (
            <a
              href={`/pass/${conversation.inquiryId}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 bg-stone-50 hover:bg-rose-50 text-rose-700 hover:border-rose-200 rounded-xl text-[11px] font-bold border border-stone-200/80 transition-colors flex items-center gap-1 shadow-xs"
              title="View Digital Pass"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pass</span>
            </a>
          )}

          {/* Toggle Attendee Info Drawer */}
          <button
            type="button"
            onClick={onToggleInfo}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors flex items-center gap-1 shadow-xs cursor-pointer ${
              showInfo
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200/80'
            }`}
          >
            <UsersIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Info</span>
          </button>

          {/* Close/Reopen status toggle */}
          <button
            type="button"
            onClick={onToggleStatus}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-xs cursor-pointer ${
              conversation.status === 'OPEN'
                ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            {conversation.status === 'OPEN' ? 'Close' : 'Reopen'}
          </button>
        </div>
      </div>

      {/* 24-Hour Session Status Sub-banner */}
      <div
        className={`px-3 sm:px-4 py-1.5 text-[11px] flex items-center justify-between border-t transition-colors ${
          isWindowActive
            ? 'bg-emerald-50/80 border-emerald-200/70 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200/70 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-1.5">
          {isWindowActive ? (
            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircleIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          )}
          <span className="font-semibold truncate">
            {isWindowActive
              ? `24h Session Active (${formatTimeLeft(conversation.windowRemainingSeconds)}) — Free-form chat open`
              : '24h Session Expired — Meta requires an approved template to message'}
          </span>
        </div>
      </div>
    </div>
  );
};
