import React from 'react';
import {
  WhatsappConversationItem,
  ConversationNote
} from '@/services/admin/whatsappApi';
import {
  XIcon,
  MessageCircleIcon,
  TicketIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  LockIcon,
  ExternalLinkIcon,
  SparklesIcon
} from '@/components/Icons';
import toast from 'react-hot-toast';

interface ContactDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: WhatsappConversationItem;
  notes: ConversationNote[];
  eventName?: string;
}

export const ContactDetailsDrawer: React.FC<ContactDetailsDrawerProps> = ({
  isOpen,
  onClose,
  conversation,
  notes,
  eventName
}) => {
  if (!isOpen) return null;

  const handleCopyInquiryId = () => {
    if (!conversation.inquiryId) return;
    navigator.clipboard.writeText(conversation.inquiryId);
    toast.success('Inquiry ID copied to clipboard!');
  };

  const initials = (conversation.customerName || 'WG')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="w-full sm:w-[320px] bg-white border-l border-stone-200/90 flex flex-col h-full select-none flex-shrink-0 shadow-lg sm:shadow-none">
      {/* Top Header */}
      <div className="p-3.5 bg-stone-50 border-b border-stone-200/80 flex items-center justify-between">
        <span className="font-black text-xs text-stone-900 tracking-tight">Attendee Dossier</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Profile Card */}
        <div className="text-center pb-3 border-b border-stone-100">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-800 to-stone-900 text-white flex items-center justify-center font-black text-lg mx-auto mb-2 shadow-xs">
            {initials}
          </div>
          <h4 className="font-black text-sm text-stone-900 leading-tight">
            {conversation.customerName}
          </h4>
          <p className="font-mono text-[11px] text-stone-500 font-bold mt-0.5">
            {conversation.phoneMasked}
          </p>

          <div className="flex justify-center gap-2 mt-2.5">
            <a
              href={`https://wa.me/${conversation.phone}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px] border border-emerald-200 transition-colors flex items-center gap-1 shadow-2xs"
            >
              <MessageCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp Direct</span>
            </a>
          </div>
        </div>

        {/* Token ID Box */}
        <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-stone-400 font-bold uppercase text-[9px] tracking-wider">
              Token ID
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-stone-900 text-xs">
                {conversation.inquiryId || 'Unassigned'}
              </span>
              {conversation.inquiryId && (
                <button
                  type="button"
                  onClick={handleCopyInquiryId}
                  className="text-[10px] text-rose-700 hover:underline font-bold cursor-pointer"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/50">
            <span className="text-stone-400 font-bold uppercase text-[9px] tracking-wider">
              Chat Status
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                conversation.status === 'OPEN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-stone-200 text-stone-700'
              }`}
            >
              {conversation.status}
            </span>
          </div>
        </div>

        {/* Seminar Slot Info */}
        <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/80 space-y-2">
          <span className="text-stone-400 font-bold uppercase text-[9px] tracking-wider block">
            Seminar Slot
          </span>
          <p className="font-bold text-stone-900 text-xs leading-snug">
            {eventName || 'Ek Duje Ke Liye Seminar'}
          </p>
        </div>

        {/* Quick Links */}
        {conversation.inquiryId && (
          <div className="space-y-1.5 pt-1">
            <a
              href={`/pass/${conversation.inquiryId}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              <span>Open Digital Pass ↗</span>
            </a>

            <a
              href={`/invitation/${conversation.inquiryId}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-rose-200 transition-colors"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-rose-600" />
              <span>Invitation Card ↗</span>
            </a>
          </div>
        )}

        {/* Internal Notes History */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          <span className="text-stone-400 font-bold uppercase text-[9px] tracking-wider block">
            Internal Staff Remarks ({notes.length})
          </span>

          {notes.length === 0 ? (
            <p className="text-[11px] text-stone-400 italic">No notes added yet for this contact.</p>
          ) : (
            notes.map((note, i) => (
              <div key={i} className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/70 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-[9px] text-amber-800/80 font-bold">
                  <span>{note.adminName || 'Staff'}</span>
                  <span className="font-mono">{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-amber-950 font-medium whitespace-pre-wrap leading-relaxed">
                  {note.text}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
