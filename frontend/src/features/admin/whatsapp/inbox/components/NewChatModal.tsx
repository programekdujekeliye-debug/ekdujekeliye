import React, { useState } from 'react';
import { XIcon, MessageSquareIcon, SearchIcon } from '@/components/Icons';
import toast from 'react-hot-toast';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPhone: (phone: string, inquiryId?: string) => Promise<string>;
  onSelectConversationId: (id: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onOpenPhone,
  onSelectConversationId
}) => {
  const [phone, setPhone] = useState('');
  const [inquiryId, setInquiryId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    const cleanInquiryId = inquiryId.trim();

    if (!cleanPhone && !cleanInquiryId) {
      toast.error('Please enter a 10-digit mobile number or Inquiry ID.');
      return;
    }

    try {
      setSubmitting(true);
      const convId = await onOpenPhone(cleanPhone, cleanInquiryId);
      onSelectConversationId(convId);
      toast.success('Chat loaded successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Could not find or create chat for this contact.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center">
              <MessageSquareIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">Start / Find Chat</h3>
              <p className="text-[11px] text-stone-500">Open conversation by phone or token ID</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-stone-700 block mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 9898332835"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-xs text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-wider">
            — OR —
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">
              Inquiry / Token ID
            </label>
            <input
              type="text"
              value={inquiryId}
              onChange={e => setInquiryId(e.target.value.toUpperCase())}
              placeholder="e.g. EK06-337 or CPL1-040"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-xs text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <SearchIcon className="w-3.5 h-3.5" />
              <span>{submitting ? 'Searching...' : 'Open Chat'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
