import React, { useEffect } from 'react';
import {
  WhatsappConversationItem,
  ConversationNote
} from '@/services/admin/whatsappApi';
import {
  XIcon,
  MessageCircleIcon,
  TicketIcon,
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
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyInquiryId = () => {
    if (!conversation.inquiryId) return;
    navigator.clipboard.writeText(conversation.inquiryId);
    toast.success('Token ID copied!');
  };

  const initials = (conversation.customerName || 'WG')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-in fade-in duration-150">
      {/* 1. Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Slide-Over Panel Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm sm:max-w-md bg-white shadow-2xl border-l border-slate-200/90 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
          {/* Top Header */}
          <div className="p-4 bg-[#FAF9F6] border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-900 tracking-tight">Attendee Dossier</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-mono font-extrabold text-[10px]">
                {conversation.inquiryId || 'Unassigned'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              aria-label="Close dossier"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* Profile Card */}
            <div className="text-center pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#881337] to-[#BE123C] text-white flex items-center justify-center font-black text-xl mx-auto mb-2.5 shadow-xs">
                {initials}
              </div>
              <h4 className="font-black text-base text-slate-900 leading-tight">
                {conversation.customerName}
              </h4>
              <p className="font-mono text-xs text-slate-500 font-bold mt-1">
                {conversation.phoneMasked}
              </p>

              <div className="flex justify-center gap-2 mt-3">
                <a
                  href={`https://wa.me/${conversation.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs border border-emerald-200 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <MessageCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp Direct</span>
                </a>
              </div>
            </div>

            {/* Token & Status Box */}
            <div className="bg-[#FAF9F6] p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                  Registration Token ID
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-slate-900 text-xs">
                    {conversation.inquiryId || 'Unassigned'}
                  </span>
                  {conversation.inquiryId && (
                    <button
                      type="button"
                      onClick={handleCopyInquiryId}
                      className="text-[10px] text-[#881337] hover:underline font-bold cursor-pointer"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                  Session Status
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    conversation.status === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {conversation.status}
                </span>
              </div>
            </div>

            {/* Seminar Slot Info */}
            <div className="bg-[#FAF9F6] p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">
                Seminar Event
              </span>
              <p className="font-bold text-slate-900 text-xs leading-snug">
                {eventName || 'Ek Duje Ke Liye Seminar'}
              </p>
            </div>

            {/* Quick Links */}
            {conversation.inquiryId && (
              <div className="space-y-2 pt-1">
                <a
                  href={`/pass/${conversation.inquiryId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 bg-[#881337] hover:bg-[#9F1239] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <TicketIcon className="w-3.5 h-3.5" />
                  <span>Open Digital Pass ↗</span>
                </a>

                <a
                  href={`/invitation/${conversation.inquiryId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-[#881337] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-rose-200 transition-colors"
                >
                  <SparklesIcon className="w-3.5 h-3.5 text-[#881337]" />
                  <span>Couple Invitation Card ↗</span>
                </a>
              </div>
            )}

            {/* Internal Staff Notes History */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">
                Internal Staff Remarks ({notes.length})
              </span>

              {notes.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No notes recorded for this contact yet.</p>
              ) : (
                notes.map((note, i) => (
                  <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-[9px] text-amber-800 font-bold">
                      <span>{note.adminName || 'Staff'}</span>
                      <span className="font-mono">{new Date(note.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-amber-950 font-medium whitespace-pre-wrap break-words leading-relaxed">
                      {note.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
