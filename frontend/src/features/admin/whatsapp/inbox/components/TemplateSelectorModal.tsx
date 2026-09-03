import React, { useState } from 'react';
import { MetaTemplate } from '@/types/whatsapp';
import { XIcon, SendIcon, SparklesIcon } from '@/components/Icons';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  metaTemplates: MetaTemplate[];
  customerName: string;
  onSendTemplate: (templateKey: string) => Promise<void>;
  sending: boolean;
}

const HUMAN_FRIENDLY_TEMPLATES: Record<string, { title: string; gujarati: string; description: string }> = {
  edkl_payment_confirmed_pass_v1: {
    title: 'Digital Pass Delivery',
    gujarati: 'ડિજિટલ પાસ અને સીટ કન્ફર્મેશન',
    description: 'Sends official confirmed digital entry pass with gate instructions.'
  },
  edkl_polite_payment_pending_v1: {
    title: 'Payment Pending Link',
    gujarati: 'પેમેન્ટ પેન્ડિંગ રીમાઇન્ડર અને લિંક',
    description: 'Sends friendly payment completion link to confirm registration.'
  },
  edkl_september_gift_share_v3: {
    title: 'September Invitation & Gift',
    gujarati: '૭ & ૧૧ સપ્ટેમ્બર આમંત્રણ અને ગિફ્ટ મેસેજ',
    description: 'Invites couple to 7 & 11 September seminar or gift to family/friends.'
  },
  edkl_all_couples_invite_v1: {
    title: 'All Couples Invitation',
    gujarati: 'સામાન્ય કપલ સેમિનાર આમંત્રણ',
    description: 'Broadcast invitation for married, engaged, or committed couples.'
  },
  edkl_post_event_memories_feedback_v1: {
    title: 'Memories & Feedback Request',
    gujarati: 'કાર્યક્રમ યાદો અને પ્રતિસાદ લિંક',
    description: 'Sends event photo gallery and feedback submission link.'
  }
};

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  isOpen,
  onClose,
  metaTemplates,
  customerName,
  onSendTemplate,
  sending
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(
    metaTemplates[0]?.key || 'edkl_payment_confirmed_pass_v1'
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey) return;
    await onSendTemplate(selectedKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-[#881337]" />
              <span>Select WhatsApp Template</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Re-engage with <strong className="text-slate-800">{customerName}</strong> via approved Meta template.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Template List Selection */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {metaTemplates.map(tpl => {
              const meta = HUMAN_FRIENDLY_TEMPLATES[tpl.key] || {
                title: tpl.metaName,
                gujarati: tpl.purpose || 'સત્તાવાર મેટા ટેમ્પલેટ',
                description: tpl.category
              };
              const isSelected = selectedKey === tpl.key;

              return (
                <div
                  key={tpl.key}
                  onClick={() => setSelectedKey(tpl.key)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-rose-50/70 border-[#881337] ring-1 ring-[#881337]/20 shadow-xs'
                      : 'bg-[#FAF9F6] hover:bg-slate-100/70 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-extrabold text-xs text-slate-900">
                      {meta.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                      {tpl.category}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#881337] font-bold">
                    {meta.gujarati}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    {meta.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !selectedKey}
              className="px-4 py-2 bg-[#881337] hover:bg-[#9F1239] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <SendIcon className="w-3.5 h-3.5" />
              <span>{sending ? 'Sending...' : 'Send Template'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
