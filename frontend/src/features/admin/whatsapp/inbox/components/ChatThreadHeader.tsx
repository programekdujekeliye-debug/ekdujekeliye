import React from 'react';
import { WhatsappConversationItem } from '@/services/admin/whatsappApi';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import {
  ChevronLeftIcon,
  TicketIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon
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

  const displayName =
    conversation.customerName &&
    conversation.customerName !== 'WhatsApp Guest' &&
    !conversation.customerName.startsWith('91') &&
    !conversation.customerName.includes('*')
      ? conversation.customerName
      : formatPhone(conversation.phone);

  const formatTimeLeft = (sec?: number) => {
    if (!sec || sec <= 0) return 'Expired';
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  const photoUrl =
    conversation.couplePhoto ||
    conversation.registration?.couplePhoto ||
    (conversation.registrationId as any)?.couplePhoto ||
    null;

  return (
    <div className="bg-[#F5F2EB] border-b border-stone-200 select-none flex-shrink-0 w-full">
      {/* Primary Header Row */}
      <div className="p-2.5 sm:p-3.5 flex items-center justify-between gap-2">
        {/* Left: Mobile Back Button + DP Photo + Name */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={onBackToMobileList}
            className="md:hidden p-2 -ml-1 text-stone-700 hover:text-stone-900 active:bg-stone-200/60 rounded-xl transition-colors cursor-pointer flex items-center justify-center min-w-[36px] min-h-[36px]"
            aria-label="Back to conversations list"
            title="Back to all chats"
          >
            <ChevronLeftIcon className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Visible DP Photo */}
          <WhatsAppAvatar
            name={displayName}
            photoUrl={photoUrl}
            size="md"
            isWindowActive={isWindowActive}
          />

          {/* Couple Name & Metadata */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="font-extrabold text-stone-900 text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[220px]">
                {displayName}
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-stone-500 font-bold hidden xs:inline">
                {formatPhone(conversation.phone)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-stone-600 truncate">
              {conversation.inquiryId && (
                <span className="px-1.5 py-0.2 rounded bg-white text-stone-800 font-mono font-bold text-[9px] border border-stone-200 flex-shrink-0">
                  {conversation.inquiryId}
                </span>
              )}
              <span className="truncate text-stone-500">{eventName || 'WhatsApp Attendee / Lead'}</span>
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
              className="px-2.5 py-1.5 bg-white hover:bg-stone-50 text-[#881337] rounded-xl text-[11px] font-bold border border-stone-200 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="View Confirmed Pass"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pass</span>
            </a>
          )}

          {/* Open Attendee Info Slide-Over Drawer */}
          <button
            type="button"
            onClick={onOpenInfo}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            title="View Couple Dossier & Remarks"
          >
            <UsersIcon className="w-3.5 h-3.5 text-[#881337]" />
            <span>Info</span>
          </button>

          {/* Close/Reopen Status Toggle */}
          <button
            type="button"
            onClick={onToggleStatus}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
              conversation.status === 'OPEN'
                ? 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            {conversation.status === 'OPEN' ? 'Mark Resolved' : 'Reopen'}
          </button>
        </div>
      </div>

      {/* 24-Hour Session Status Sub-banner */}
      <div
        className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-[11px] flex items-center justify-between border-t transition-colors ${
          isWindowActive
            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950 font-medium'
            : 'bg-amber-50/90 border-amber-200 text-amber-950 font-medium'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isWindowActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="truncate">
            {isWindowActive
              ? `24-Hour WhatsApp Service Window Active (${formatTimeLeft(conversation.windowRemainingSeconds)})`
              : '24-Hour Customer Window Expired — Standard WhatsApp Meta Policy'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`px-2 py-0.2 rounded-md font-bold text-[9px] uppercase tracking-wider ${
              isWindowActive
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {isWindowActive ? '2-Way Live Chat' : 'Template Required'}
          </span>
        </div>
      </div>
    </div>
  );
};
