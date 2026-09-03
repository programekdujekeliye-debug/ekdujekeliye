import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, SparklesIcon, LockIcon } from '@/components/Icons';
import { QuickRepliesBar } from './QuickRepliesBar';

interface ChatComposerProps {
  isWindowActive: boolean;
  onSendReply: (text: string) => Promise<void>;
  onAddNote: (text: string) => Promise<void>;
  onOpenTemplateModal: () => void;
  sendingReply: boolean;
  addingNote: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  isWindowActive,
  onSendReply,
  onAddNote,
  onOpenTemplateModal,
  sendingReply,
  addingNote
}) => {
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    if (mode === 'reply') {
      await onSendReply(trimmed);
      setText('');
    } else {
      await onAddNote(trimmed);
      setText('');
    }
  };

  const handleSelectQuickReply = (qr: string) => {
    setText(qr);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // 1. If 24-Hour Session is Expired:
  if (!isWindowActive) {
    return (
      <div className="p-3 bg-amber-50/90 border-t border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <p className="text-xs font-black text-amber-950">
            24-Hour WhatsApp Session Expired
          </p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Meta rules require an approved template to message after 24 hours of inactivity.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenTemplateModal}
          className="w-full sm:w-auto px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <SparklesIcon className="w-3.5 h-3.5 text-amber-200" />
          <span>Send Approved Template</span>
        </button>
      </div>
    );
  }

  // 2. Active Session: Live Chat Composer
  return (
    <div className="bg-stone-50 border-t border-stone-200/90">
      {/* Quick Replies Bar */}
      {mode === 'reply' && <QuickRepliesBar onSelectReply={handleSelectQuickReply} />}

      {/* Main Input Box */}
      <form onSubmit={handleSubmit} className="p-2.5 sm:p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          {/* Mode Switcher: Reply vs Note */}
          <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-xl text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setMode('reply')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                mode === 'reply'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              💬 WhatsApp Chat
            </button>
            <button
              type="button"
              onClick={() => setMode('note')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                mode === 'note'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LockIcon className="w-2.5 h-2.5" />
              <span>Internal Note</span>
            </button>
          </div>

          <span className="text-[10px] text-stone-400 hidden sm:inline">
            Enter to send &bull; Shift+Enter for new line
          </span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                mode === 'reply'
                  ? 'Type your message on WhatsApp in Gujarati or English...'
                  : 'Write an internal staff note (visible only to admins)...'
              }
              className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-medium focus:outline-none resize-none transition-all ${
                mode === 'reply'
                  ? 'bg-white border border-stone-200 text-stone-900 focus:ring-1 focus:ring-rose-500 shadow-xs placeholder:text-stone-400'
                  : 'bg-amber-50 border border-amber-300 text-amber-950 focus:ring-1 focus:ring-amber-500 shadow-xs'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={sendingReply || addingNote || !text.trim()}
            className={`px-4 py-2.5 font-bold text-xs rounded-2xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer flex-shrink-0 ${
              mode === 'reply'
                ? 'bg-stone-900 hover:bg-rose-900 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <SendIcon className="w-3.5 h-3.5" />
            <span>
              {sendingReply || addingNote
                ? 'Sending...'
                : mode === 'reply'
                ? 'Send'
                : 'Save'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
