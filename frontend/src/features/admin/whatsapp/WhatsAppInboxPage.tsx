'use client';

import React, { useState, useEffect } from 'react';
import { whatsappApi, PersonTimelineResponse } from '../../../services/admin/whatsappApi';
import { eventsApi } from '../../../services/admin/eventsApi';
import { MetaTemplate } from '../../../types/whatsapp';
import { Program } from '../../../types/event';
import {
  MessageSquareIcon,
  ClockIcon,
  RefreshCwIcon,
  XIcon
} from '../../../components/Icons';
import { WhatsAppInbox } from './WhatsAppInbox';

export const WhatsAppInboxPage = () => {
  const [events, setEvents] = useState<Program[]>([]);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);

  // Timeline Drawer State
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<PersonTimelineResponse | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [resendingKey, setResendingKey] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [evts, tpls] = await Promise.all([
          eventsApi.getEvents(),
          whatsappApi.getMetaTemplates()
        ]);
        if (evts && evts.length > 0) setEvents(evts);
        if (tpls?.metaTemplates) setMetaTemplates(tpls.metaTemplates);
      } catch (err) {
        console.error('Failed to load initial data in Inbox Page:', err);
      }
    };
    init();
  }, []);

  const openPersonDrawer = async (inquiryId: string) => {
    setSelectedInquiryId(inquiryId);
    setResendStatus(null);
    try {
      setLoadingTimeline(true);
      const res = await whatsappApi.getTimeline(inquiryId);
      if (res && res.timeline) {
        setTimelineData(res);
      }
    } catch (err) {
      console.error('Error loading timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleResend = async (inquiryId: string, templateKey: string) => {
    if (!confirm(`Are you sure you want to resend '${templateKey}' to ${inquiryId}?`)) return;
    try {
      setResendingKey(templateKey);
      setResendStatus(null);
      const res = await whatsappApi.resendMessage(inquiryId, templateKey);
      if (res.success) {
        setResendStatus('Message successfully queued.');
        openPersonDrawer(inquiryId);
      } else {
        setResendStatus(`Failed: ${res.message}`);
      }
    } catch (err: any) {
      setResendStatus(`Error: ${err.message || 'Could not resend.'}`);
    } finally {
      setResendingKey(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'READ') return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200">READ</span>;
    if (s === 'DELIVERED') return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">DELIVERED</span>;
    if (s === 'SENT') return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">SENT</span>;
    if (s === 'QUEUED' || s === 'SCHEDULED' || s === 'PENDING') return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">{s}</span>;
    if (s === 'FAILED') return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">FAILED</span>;
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-50 text-slate-400 border border-slate-200">NOT SENT</span>;
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-20">
      {/* Top Header */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shadow-xs flex-shrink-0">
            <MessageSquareIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">WhatsApp Support Inbox</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live 2-Way Chat
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Direct two-way attendee inquiries, 24-hour customer window management, and staff team notes.
            </p>
          </div>
        </div>
      </div>

      {/* Main Inbox Component */}
      <WhatsAppInbox
        events={events}
        metaTemplates={metaTemplates}
        onOpenTimeline={openPersonDrawer}
      />

      {/* Slide-out Timeline Drawer */}
      {selectedInquiryId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl p-4 sm:p-6 overflow-y-auto space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">{timelineData?.customerName || selectedInquiryId}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                    <span className="font-bold text-rose-700">{timelineData?.inquiryId}</span> &bull; <span>{timelineData?.phoneNumberMasked}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedInquiryId(null);
                    setTimelineData(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              {timelineData?.totals && (
                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Attempted</span>
                    <span className="text-sm font-black text-slate-900">{timelineData.totals.attempted}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-teal-700 block">Delivered</span>
                    <span className="text-sm font-black text-teal-800">{timelineData.totals.delivered}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-emerald-700 block">Read</span>
                    <span className="text-sm font-black text-emerald-800">{timelineData.totals.read}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-rose-700 block">Failed</span>
                    <span className="text-sm font-black text-rose-800">{timelineData.totals.failed}</span>
                  </div>
                </div>
              )}

              {resendStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold">
                  {resendStatus}
                </div>
              )}

              <div className="space-y-2.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Communication Lifecycle Feed</span>
                {loadingTimeline ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-600" />
                    Loading timeline...
                  </div>
                ) : (
                  timelineData?.timeline?.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 capitalize">
                          {item.messageType.replace(/_/g, ' ')}
                        </span>
                        {renderStatusBadge(item.status)}
                      </div>

                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono space-y-0.5">
                        <div><strong>Template:</strong> {item.templateName} &bull; <strong>Trigger:</strong> {item.trigger}</div>
                        {item.lastErrorMessage && (
                          <div className="text-rose-600"><strong>Error:</strong> {item.lastErrorMessage}</div>
                        )}
                        {item.providerMessageId && (
                          <div className="text-slate-400 truncate"><strong>wamid:</strong> {item.providerMessageId}</div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-mono">
                        <span>{item.sentAt ? new Date(item.sentAt).toLocaleString('en-IN') : 'Not sent yet'}</span>
                        {item.status === 'FAILED' && (
                          <button
                            onClick={() => handleResend(timelineData.inquiryId, item.templateName || item.messageType)}
                            disabled={resendingKey === (item.templateName || item.messageType)}
                            className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold cursor-pointer hover:bg-rose-700"
                          >
                            {resendingKey === (item.templateName || item.messageType) ? 'Resending...' : 'Resend'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedInquiryId(null);
                setTimelineData(null);
              }}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
