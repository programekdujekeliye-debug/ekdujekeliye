import React from 'react';
import { WhatsappThreadMessage } from '@/services/admin/whatsappApi';
import {
  CheckIcon,
  CheckCheckIcon,
  ClockIcon,
  AlertTriangleIcon,
  SparklesIcon,
  LockIcon
} from '@/components/Icons';

interface MessageBubbleProps {
  message: WhatsappThreadMessage;
  customerName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  customerName
}) => {
  const isInbound = message.direction === 'INBOUND';
  const isAutomation =
    message.executionSource !== 'ADMIN_REPLY' &&
    message.executionSource !== 'INBOUND_WEBHOOK' &&
    Boolean(message.templateName);
  const isInternalNote = message.isInternalNote;

  const formatMessageTime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Status Checkmarks Indicator
  const renderDeliveryStatus = () => {
    if (message.status === 'SENDING') {
      return (
        <span title="Sending...">
          <ClockIcon className="w-3 h-3 text-rose-200 animate-spin" />
        </span>
      );
    }
    if (message.status === 'READ') {
      return (
        <span className="flex items-center text-sky-300 font-bold" title="Read (Blue Ticks)">
          <CheckCheckIcon className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (message.status === 'DELIVERED') {
      return (
        <span className="flex items-center text-rose-200" title="Delivered to phone">
          <CheckCheckIcon className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (message.status === 'FAILED') {
      return (
        <span className="flex items-center text-red-300" title="Failed to deliver">
          <AlertTriangleIcon className="w-3.5 h-3.5" />
        </span>
      );
    }
    return (
      <span className="flex items-center text-rose-200" title="Sent by Meta">
        <CheckIcon className="w-3.5 h-3.5" />
      </span>
    );
  };

  // 1. Internal Staff Note
  if (isInternalNote) {
    return (
      <div className="flex justify-center my-2 select-none w-full">
        <div className="max-w-md w-full bg-amber-50/95 border border-amber-200/90 rounded-2xl p-3 text-xs shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-amber-900 uppercase">
            <span className="flex items-center gap-1">
              <LockIcon className="w-3 h-3 text-amber-700" />
              <span>Internal Staff Note</span>
            </span>
            <span className="text-amber-700 font-mono">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
          <p className="text-amber-950 font-medium whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // 2. Lifecycle Automation Card (Structured Notification)
  if (isAutomation) {
    return (
      <div className="flex justify-center my-2 select-none w-full">
        <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-1.5 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#881337] uppercase tracking-wider">
              <SparklesIcon className="w-3.5 h-3.5 text-[#881337]" />
              <span>
                {message.messageType === 'payment_confirmation'
                  ? 'Payment Confirmation Pass'
                  : message.messageType === 'reminder'
                  ? 'Event Reminder'
                  : 'Automated Notification'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 font-bold truncate max-w-[140px]">
              {message.templateName}
            </span>
          </div>

          <p className="text-slate-800 text-[11px] font-medium whitespace-pre-wrap break-words leading-relaxed">
            {message.content || `Template dispatched: ${message.templateName}`}
          </p>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            <span>{formatMessageTime(message.sentAt || message.createdAt)}</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-600 uppercase text-[9px]">
                {message.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Inbound Attendee Message (Left Aligned White Bubble)
  if (isInbound) {
    return (
      <div className="flex items-start gap-2 max-w-[85%] sm:max-w-[70%] my-1.5 mr-auto">
        <div className="bg-white p-3 rounded-2xl rounded-tl-xs shadow-2xs border border-slate-200/80 space-y-1">
          <span className="text-[10px] font-black text-[#881337] block">
            {customerName || 'Attendee'}
          </span>
          <p className="text-xs text-slate-900 whitespace-pre-wrap break-words leading-relaxed font-medium">
            {message.content}
          </p>
          <span className="text-[9px] text-slate-400 block text-right font-mono mt-0.5">
            {formatMessageTime(message.receivedAt || message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // 4. Outbound Operator Reply (Right Aligned Deep Maroon Bubble)
  return (
    <div className="flex items-start justify-end gap-2 max-w-[85%] sm:max-w-[70%] my-1.5 ml-auto">
      <div className="bg-[#881337] text-white p-3 rounded-2xl rounded-tr-xs shadow-xs space-y-1">
        <span className="text-[10px] font-extrabold text-rose-200 block">
          {message.sentByAdminName || 'Support Team'}
        </span>
        <p className="text-xs whitespace-pre-wrap break-words leading-relaxed text-white font-medium">
          {message.content}
        </p>
        <div className="flex items-center justify-end gap-1 text-[9px] text-rose-200/80 font-mono mt-0.5">
          <span>{formatMessageTime(message.sentAt || message.createdAt)}</span>
          <span className="ml-1">{renderDeliveryStatus()}</span>
        </div>
      </div>
    </div>
  );
};
