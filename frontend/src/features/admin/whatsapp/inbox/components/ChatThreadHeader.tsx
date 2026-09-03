import React from 'react';
import { WhatsappConversationItem } from '@/services/admin/whatsappApi';
import { WhatsAppAvatar } from './WhatsAppAvatar';
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
  onOpenInfo: () => void;
  onToggleStatus: () => void;
  eventName?: string;
}

export const ChatThreadHeader: React.FC<ChatThreadHeaderProps> = ({
  conversation,
  onBackToMobileList,
  onOpenInfo,
  onToggleStatus,
  eventName
}) => {
  const isWindowActive = conversation.isWindowOpen;

  const formatTimeLeft = (sec?: number) => {
    if (!sec || sec <= 0) return 'Expired';
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  const photoUrl =
    conversation.couplePhoto ||
    conversation.registration?.couplePhoto ||
    (conversation.registrationId as any)?.couplePhoto ||
    null;

  return (
    <div className="bg-[#F0EBE3] border-b border-slate-200/90 select-none flex-shrink-0 w-full">
      {/* Primary Header Row */}
      <div className="p-2.5 sm:p-3.5 flex items-center justify-between gap-2">
        {/* Left: Mobile Back Button + DP Photo + Name */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Mobile Back Button (Touch optimized) */}
          <button
            type="button"
            onClick={onBackToMobileList}
            className="md:hidden p-2 -ml-1 text-slate-700 hover:text-slate-900 active:bg-black/10 rounded-xl transition-colors cursor-pointer flex items-center justify-center min-w-[36px] min-h-[36px]"
            aria-label="Back to conversations list"
            title="Back to all chats"
          >
            <ChevronLeftIcon className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Visible DP Photo */}
          <WhatsAppAvatar
            name={conversation.customerName}
            photoUrl={photoUrl}
            size="md"
            isWindowActive={isWindowActive}
          />

          {/* Couple Name & Metadata */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[220px]">
                {conversation.customerName}
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 font-bold hidden xs:inline">
                {conversation.phoneMasked}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-600 truncate">
              {conversation.inquiryId && (
                <span className="px-1.5 py-0.2 rounded bg-white/80 text-slate-800 font-mono font-bold text-[9px] border border-slate-200/80 flex-shrink-0">
                  {conversation.inquiryId}
                </span>
              )}
              <span className="truncate">{eventName || 'Seminar Attendee'}</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Digital Pass Quick Link */}
          {conversation.inquiryId && (
            <a
              href={`/pass/${conversation.inquiryId}`}
              target="_blank"
              rel="noreferrer"
              className="px-2 sm:px-2.5 py-1.5 bg-white/80 hover:bg-white text-[#881337] rounded-xl text-[11px] font-bold border border-slate-200/80 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="View Digital Pass"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pass</span>
            </a>
          )}

          {/* Open Attendee Info Slide-Over Drawer */}
          <button
            type="button"
            onClick={onOpenInfo}
            className="px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200/80 bg-white/80 hover:bg-white text-slate-800 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            title="View Couple Dossier & Remarks"
          >
            <UsersIcon className="w-3.5 h-3.5 text-[#881337]" />
            <span>Info</span>
          </button>

          {/* Close/Reopen Status Toggle */}
          <button
            type="button"
            onClick={onToggleStatus}
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
              conversation.status === 'OPEN'
                ? 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            {conversation.status === 'OPEN' ? 'Close' : 'Reopen'}
          </button>
        </div>
      </div>

      {/* 24-Hour Session Status Sub-banner */}
      <div
        className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-[11px] flex items-center justify-between border-t transition-colors ${
          isWindowActive
            ? 'bg-emerald-50/90 border-emerald-200/70 text-emerald-950'
            : 'bg-amber-50/90 border-amber-200/70 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isWindowActive ? (
            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircleIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          )}
          <span className="font-semibold truncate">
            {isWindowActive
              ? `24h Window Active (${formatTimeLeft(conversation.windowRemainingSeconds)}) — Free-form chat permitted`
              : '24h Window Expired — Send approved template to re-open'}
          </span>
        </div>
      </div>
    </div>
  );
};
