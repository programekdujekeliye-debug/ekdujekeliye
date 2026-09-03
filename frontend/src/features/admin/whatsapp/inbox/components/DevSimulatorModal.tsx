import React, { useState } from 'react';
import { XIcon, MessageSquareIcon } from '@/components/Icons';
import { whatsappApi } from '@/services/admin/whatsappApi';
import toast from 'react-hot-toast';

interface DevSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  onSimulated: () => void;
}

const PRESET_SIMULATED_MESSAGES = [
  'Hello! Is my payment confirmed for the seminar?',
  'Can you please send me my VIP pass link again?',
  'What is the reporting time and venue location?',
  'Hello, I want to update my partner name on the pass.'
];

export const DevSimulatorModal: React.FC<DevSimulatorModalProps> = ({
  isOpen,
  onClose,
  defaultPhone = '8320594829',
  onSimulated
}) => {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState('Hello! Checking support inbox.');
  const [simulating, setSimulating] = useState(false);

  if (!isOpen) return null;

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) {
      toast.error('Please enter a phone number and message.');
      return;
    }

    try {
      setSimulating(true);
      const res = await whatsappApi.simulateInboundMessage({
        phone: phone.trim(),
        text: message.trim()
      });

      if (res.success) {
        toast.success('Inbound message simulated successfully! 24h window opened.');
        onSimulated();
        onClose();
      } else {
        toast.error((res as any).error || 'Failed to simulate message.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Simulation error.');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <MessageSquareIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">Inbound Webhook Live Tester</h3>
              <p className="text-[11px] text-slate-500">Simulate customer replies to activate the 24h service window</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSimulate} className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
              Sender Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 8320594829"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
              Message Content
            </label>
            <textarea
              rows={2}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type simulated incoming message..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Preset Suggestions */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Suggestions:</span>
            <div className="space-y-1">
              {PRESET_SIMULATED_MESSAGES.map((msg, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMessage(msg)}
                  className="w-full text-left p-1.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg text-[11px] text-slate-700 border border-slate-200 transition-colors"
                >
                  &quot;{msg}&quot;
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900">
            <strong>Webhook Callback:</strong> In production, Meta delivers real webhooks to <code>/api/whatsapp/webhook</code>. This test tool activates the exact same pipeline locally!
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={simulating || !phone.trim() || !message.trim()}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {simulating ? 'Simulating...' : 'Simulate & Open Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
