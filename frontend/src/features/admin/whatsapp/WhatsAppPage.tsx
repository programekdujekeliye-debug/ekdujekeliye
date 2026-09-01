'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  whatsappApi,
  EventCommunicationDashboardResponse,
  RegistrationCommunicationRow,
  PersonTimelineResponse,
  WhatsappLogItem
} from '../../../services/admin/whatsappApi';
import { eventsApi } from '../../../services/admin/eventsApi';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { MetaTemplate } from '../../../types/whatsapp';
import { Program } from '../../../types/event';
import { Submission } from '../../../types';
import {
  MessageCircleIcon,
  ShieldCheckIcon,
  TicketIcon,
  WhatsappIcon,
  CheckIcon,
  AlertTriangleIcon,
  SearchIcon,
  ClockIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  EyeIcon
} from '../../../components/Icons';
import { LuxurySelect } from '../../../components/LuxurySelect';
import toast from 'react-hot-toast';

export const WhatsAppPage = () => {
  // Navigation Sub-tabs: 'dashboard' | 'templates' | 'logs'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'templates' | 'logs'>('dashboard');

  // Events & Selected Event
  const [events, setEvents] = useState<Program[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Dashboard Overview & Registration List State
  const [dashboardData, setDashboardData] = useState<EventCommunicationDashboardResponse | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationCommunicationRow[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');
  const [messageStatusFilter, setMessageStatusFilter] = useState('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');

  // Person Timeline Drawer Modal
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<PersonTimelineResponse | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [resendingKey, setResendingKey] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Broadcast Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState<'ALL_CONFIRMED' | 'PAYMENT_PENDING' | 'ATTENDED'>('ALL_CONFIRMED');
  const [broadcastTemplateKey, setBroadcastTemplateKey] = useState('edkl_event_update_v1');
  const [broadcastCustomMsg, setBroadcastCustomMsg] = useState('');
  const [broadcastPreview, setBroadcastPreview] = useState<{ totalRegistrations: number; eligibleCount: number; optedOutCount: number; missingPhoneCount: number; finalRecipientCount: number } | null>(null);
  const [previewingBroadcast, setPreviewingBroadcast] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Gallery Modal
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState('https://www.ekdujekeliye.in/gallery');
  const [sendingGallery, setSendingGallery] = useState(false);

  // Templates Tab State (Manual Test Tool)
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const [customPhone, setCustomPhone] = useState('918320594829');
  const [customName, setCustomName] = useState('Jaynesh & Partner');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('edkl_payment_confirmed_pass_v1');
  const [sendingTest, setSendingTest] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Logs Tab State
  const [logs, setLogs] = useState<WhatsappLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [runningWorker, setRunningWorker] = useState(false);

  const handleRunWorker = async () => {
    setRunningWorker(true);
    try {
      const res = await whatsappApi.runWorker();
      if (res?.success) {
        const summary = res.summary || {};
        toast.success(`Worker run complete: Sent ${summary.sent ?? 0}, Processed ${summary.processed ?? 0}`);
        await Promise.all([
          fetchDashboardData(selectedEventId),
          fetchRegistrations(selectedEventId, pagination.page)
        ]);
      } else {
        toast.error(res?.error || 'Worker execution failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger worker');
    } finally {
      setRunningWorker(false);
    }
  };

  // 1. Initial Load: Events & Meta Templates
  useEffect(() => {
    const init = async () => {
      try {
        const [evts, tpls, subs] = await Promise.all([
          eventsApi.getEvents(),
          whatsappApi.getMetaTemplates(),
          registrationsApi.getSubmissions({ limit: 100 })
        ]);
        if (evts && evts.length > 0) {
          setEvents(evts);
          setSelectedEventId(evts[0].id || (evts[0] as any)._id || '');
        }
        if (tpls?.metaTemplates) setMetaTemplates(tpls.metaTemplates);
        if (subs?.submissions) {
          setSubmissions(subs.submissions);
          if (subs.submissions.length > 0) {
            setSelectedSubmissionId(subs.submissions[0]._id || subs.submissions[0].inquiryId || '');
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    init();
  }, []);

  // 2. Fetch Event Dashboard Data
  const fetchDashboardData = async (eventId: string) => {
    if (!eventId) return;
    try {
      setLoadingDashboard(true);
      const res = await whatsappApi.getEventDashboard(eventId);
      if (res && res.summary) {
        setDashboardData(res);
      }
    } catch (err) {
      console.error('Error fetching dashboard overview:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // 3. Fetch Event Registrations Table
  const fetchRegistrations = async (eventId: string, pageNum = 1) => {
    if (!eventId) return;
    try {
      setLoadingRegistrations(true);
      const res = await whatsappApi.getEventRegistrations(eventId, {
        page: pageNum,
        limit: pagination.limit,
        search: searchQuery,
        paymentStatus: paymentFilter,
        health: healthFilter,
        messageStatus: messageStatusFilter,
        attendance: attendanceFilter
      });
      if (res && res.rows) {
        setRegistrations(res.rows);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Error fetching registrations communication:', err);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  // Trigger when selectedEventId or filters change
  useEffect(() => {
    if (selectedEventId) {
      fetchDashboardData(selectedEventId);
      fetchRegistrations(selectedEventId, 1);
    }
  }, [selectedEventId, paymentFilter, healthFilter, messageStatusFilter, attendanceFilter]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedEventId) {
        fetchRegistrations(selectedEventId, 1);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Timeline when person modal opens
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

  // Manual Resend Handler
  const handleResend = async (inquiryId: string, templateKey: string) => {
    if (!confirm(`Are you sure you want to resend '${templateKey}' to ${inquiryId}?`)) return;
    try {
      setResendingKey(templateKey);
      setResendStatus(null);
      const res = await whatsappApi.resendMessage(inquiryId, templateKey);
      if (res.success) {
        setResendStatus('Message successfully queued / sent!');
        // Refresh timeline
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

  // Preview Broadcast Audience
  const handlePreviewBroadcast = async () => {
    if (!selectedEventId) return;
    try {
      setPreviewingBroadcast(true);
      const res = await whatsappApi.previewBroadcast(selectedEventId, broadcastAudience);
      setBroadcastPreview(res);
    } catch (err) {
      console.error('Failed to preview broadcast audience:', err);
    } finally {
      setPreviewingBroadcast(false);
    }
  };

  // Launch Broadcast
  const handleSendBroadcast = async () => {
    if (!selectedEventId || !broadcastTemplateKey) return;
    if (!confirm(`Confirm launching broadcast to ${broadcastPreview?.finalRecipientCount || 0} recipients?`)) return;
    try {
      setSendingBroadcast(true);
      const res = await whatsappApi.sendBroadcast({
        eventId: selectedEventId,
        audience: broadcastAudience,
        templateKey: broadcastTemplateKey,
        customMessage: broadcastCustomMsg
      });
      toast.success(`Broadcast queued! (${res.queuedCount} messages scheduled)`);
      setShowBroadcastModal(false);
      fetchDashboardData(selectedEventId);
      fetchRegistrations(selectedEventId, pagination.page);
    } catch (err: any) {
      toast.error(`Broadcast failed: ${err.message || 'Error'}`);
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Trigger Gallery Ready
  const handleTriggerGallery = async () => {
    if (!selectedEventId) return;
    if (!confirm(`Confirm dispatching gallery link to all attended participants?`)) return;
    try {
      setSendingGallery(true);
      const res = await whatsappApi.triggerGallery(selectedEventId, galleryUrl);
      toast.success(`Gallery link queued for ${res.queuedCount} participants!`);
      setShowGalleryModal(false);
      fetchDashboardData(selectedEventId);
      fetchRegistrations(selectedEventId, pagination.page);
    } catch (err: any) {
      toast.error(`Failed to trigger gallery: ${err.message}`);
    } finally {
      setSendingGallery(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await whatsappApi.getLogs(50);
      if (res && res.logs) setLogs(res.logs);
    } catch (err) {
      console.error('Failed to refresh logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  // Send Test Message
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setDispatchResult(null);
    try {
      const res = await whatsappApi.sendTestMessage(
        customPhone,
        selectedTemplateKey,
        selectedSubmissionId || undefined,
        { customerName: customName }
      );
      setDispatchResult(res);
    } catch (err: any) {
      setDispatchResult({ success: false, message: err.message || 'Failed to dispatch test message.' });
    } finally {
      setSendingTest(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string, reasonIfMissing?: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'READ') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
          READ
        </span>
      );
    }
    if (s === 'DELIVERED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-300">
          DELIVERED
        </span>
      );
    }
    if (s === 'SENT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
          SENT
        </span>
      );
    }
    if (s === 'QUEUED' || s === 'SCHEDULED' || s === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
          {s}
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
          FAILED
        </span>
      );
    }
    if (s === 'NOT_REQUIRED') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
          NOT REQUIRED
        </span>
      );
    }
    // Missing reason badge
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-50 text-slate-500 border border-slate-200" title={reasonIfMissing || 'Not sent'}>
        {reasonIfMissing ? reasonIfMissing.replace(/_/g, ' ') : 'NOT SENT'}
      </span>
    );
  };

  const summary = dashboardData?.summary;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Sub-Navigation */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
              <WhatsappIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">WhatsApp Communication Center</h1>
              <p className="text-xs text-slate-500 font-medium">
                Live delivery &amp; read ledger, event lifecycle monitoring, broadcast controls, and per-person history.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Event Dashboard
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'templates'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Templates &amp; Test Sender
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'logs'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Delivery Audit Logs
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EVENT COMMUNICATION DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Event Selector & Actions Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Select Seminar / Event:
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 min-w-[280px]"
              >
                {events.map((evt) => (
                  <option key={evt.id || (evt as any)._id} value={evt.id || (evt as any)._id}>
                    {evt.name} — {evt.city} ({evt.date || 'TBA'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRunWorker}
                disabled={runningWorker}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Dispatch all due queued messages immediately to WhatsApp"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${runningWorker ? 'animate-spin' : ''}`} />
                <span>{runningWorker ? 'Dispatching Queue...' : 'Dispatch Due Queue (Run Worker)'}</span>
              </button>

              <button
                onClick={() => {
                  fetchDashboardData(selectedEventId);
                  fetchRegistrations(selectedEventId, pagination.page);
                }}
                disabled={loadingDashboard || loadingRegistrations}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin' : ''}`} />
                <span>Refresh Stats</span>
              </button>

              <button
                onClick={() => {
                  setShowBroadcastModal(true);
                  handlePreviewBroadcast();
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageCircleIcon className="w-3.5 h-3.5" />
                <span>Send Event Broadcast</span>
              </button>

              <button
                onClick={() => setShowGalleryModal(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Publish Gallery Link</span>
              </button>
            </div>
          </div>

          {/* Top Aggregate Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Registrations */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Registrations</span>
              <div className="text-xl font-extrabold text-slate-900">
                {summary?.totalRegistrations ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                <span className="text-emerald-700 font-bold">{summary?.confirmedRegistrations ?? 0} Paid</span> &bull; {summary?.paymentPendingRegistrations ?? 0} Pending
              </div>
            </div>

            {/* 2. Messages Sent */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Sent</span>
              <div className="text-xl font-extrabold text-blue-700">
                {summary?.totalMessagesSent ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Meta accepted wamid
              </div>
            </div>

            {/* 3. Delivered */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Delivered</span>
              <div className="text-xl font-extrabold text-teal-700">
                {summary?.totalMessagesDelivered ?? 0}
              </div>
              <div className="text-[10px] text-teal-700 font-bold">
                {summary?.deliveryRate ?? 0}% Delivery Rate
              </div>
            </div>

            {/* 4. Read */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Read (Opened)</span>
              <div className="text-xl font-extrabold text-emerald-700">
                {summary?.totalMessagesRead ?? 0}
              </div>
              <div className="text-[10px] text-emerald-700 font-bold">
                {summary?.readRate ?? 0}% of delivered
              </div>
            </div>

            {/* 5. Failed */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Failed</span>
              <div className="text-xl font-extrabold text-rose-700">
                {summary?.totalMessagesFailed ?? 0}
              </div>
              <div className="text-[10px] text-rose-700 font-bold">
                {summary?.failureRate ?? 0}% Failure Rate
              </div>
            </div>

            {/* 6. Action Needed */}
            <div
              onClick={() => setHealthFilter('ACTION_NEEDED')}
              className={`border rounded-2xl p-4 shadow-xs space-y-1 cursor-pointer transition-all ${
                healthFilter === 'ACTION_NEEDED'
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500'
                  : 'bg-white border-slate-200 hover:border-rose-300'
              }`}
            >
              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block">Action Needed</span>
              <div className="text-xl font-extrabold text-rose-800">
                {summary?.actionNeededCount ?? 0}
              </div>
              <div className="text-[10px] text-rose-600 font-bold">
                Failed dispatches
              </div>
            </div>
          </div>

          {/* Lifecycle Message Performance Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Lifecycle Message Performance Breakdown</h3>
                <p className="text-xs text-slate-500 font-medium">Real-time status metrics across each automated milestone.</p>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
                Scheduled: {summary?.totalMessagesScheduled ?? 0} pending
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                    <th className="py-2.5 px-3">Message Type</th>
                    <th className="py-2.5 px-3">Eligible</th>
                    <th className="py-2.5 px-3">Queued / Scheduled</th>
                    <th className="py-2.5 px-3">Sent</th>
                    <th className="py-2.5 px-3">Delivered</th>
                    <th className="py-2.5 px-3">Read</th>
                    <th className="py-2.5 px-3">Failed</th>
                    <th className="py-2.5 px-3 text-right">Delivery Rate</th>
                    <th className="py-2.5 px-3 text-right">Read Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {dashboardData?.messageTypeStats &&
                    Object.entries(dashboardData.messageTypeStats).map(([key, st]) => (
                      <tr key={key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900 capitalize">
                          {key.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">{st.eligible}</td>
                        <td className="py-3 px-3">
                          {st.queued > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                              {st.queued} queued
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-blue-700 font-mono font-bold">{st.sent}</td>
                        <td className="py-3 px-3 text-teal-700 font-mono font-bold">{st.delivered}</td>
                        <td className="py-3 px-3 text-emerald-700 font-mono font-bold">{st.read}</td>
                        <td className="py-3 px-3">
                          {st.failed > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded text-[10px] font-bold font-mono">
                              {st.failed} failed
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-teal-800">
                          {st.deliveryRate}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                          {st.readRate}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PER-PERSON COMMUNICATION TABLE */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Couple / Registration Communication Ledger
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Detailed delivery journey for each couple. Click any row to view full timestamp timeline &amp; resend controls.
                </p>
              </div>

              {/* Filters & Search Row */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name, phone, ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500 w-48 sm:w-56"
                  />
                </div>

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="ALL">Payment: All</option>
                  <option value="PAID">Paid Only</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="FAILED">Failed Payment</option>
                </select>

                <select
                  value={healthFilter}
                  onChange={(e) => setHealthFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="ALL">Health: All</option>
                  <option value="HEALTHY">Healthy Only</option>
                  <option value="ACTION_NEEDED">Action Needed</option>
                  <option value="PENDING">Pending Only</option>
                </select>

                <select
                  value={messageStatusFilter}
                  onChange={(e) => setMessageStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="ALL">Delivery: All</option>
                  <option value="READ">Read (Opened)</option>
                  <option value="DELIVERED_NOT_READ">Delivered Unread</option>
                  <option value="SENT_NOT_DELIVERED">Sent Undelivered</option>
                  <option value="FAILED">Failed Dispatches</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                    <th className="py-2.5 px-3">Couple / Inquiry</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3">Pass</th>
                    <th className="py-2.5 px-3">Registration</th>
                    <th className="py-2.5 px-3">Pay Reminder</th>
                    <th className="py-2.5 px-3">Confirmation</th>
                    <th className="py-2.5 px-3">48h Invitation</th>
                    <th className="py-2.5 px-3">24h Reminder</th>
                    <th className="py-2.5 px-3">Feedback</th>
                    <th className="py-2.5 px-3">Last Comm</th>
                    <th className="py-2.5 px-3">Health</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {loadingRegistrations ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-xs text-slate-500 font-medium">
                        Loading registration communication records...
                      </td>
                    </tr>
                  ) : registrations.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-xs text-slate-500">
                        No registrations matching the active filters.
                      </td>
                    </tr>
                  ) : (
                    registrations.map((row) => (
                      <tr
                        key={row.inquiryId}
                        onClick={() => openPersonDrawer(row.inquiryId)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        {/* Couple Name & Inquiry ID */}
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-900">{row.coupleName}</div>
                          <div className="font-mono text-[10px] font-bold text-rose-700">{row.inquiryId}</div>
                        </td>

                        {/* Masked Phone */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {row.maskedPhone || '-'}
                        </td>

                        {/* Payment */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              row.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : row.paymentStatus === 'FAILED'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {row.paymentStatus}
                          </span>
                        </td>

                        {/* Pass */}
                        <td className="py-3 px-3 font-mono text-[10px] font-bold">
                          {row.passStatus === 'ACTIVE' ? (
                            <span className="text-emerald-700">ACTIVE</span>
                          ) : (
                            <span className="text-slate-400">{row.passStatus}</span>
                          )}
                        </td>

                        {/* Registration Msg */}
                        <td className="py-3 px-3">
                          {renderStatusBadge(row.messages.registration.status, row.messages.registration.reasonIfMissing)}
                        </td>

                        {/* Payment Reminder */}
                        <td className="py-3 px-3">
                          {row.messages.paymentReminder.count > 0 ? (
                            <div className="space-y-0.5">
                              {renderStatusBadge(row.messages.paymentReminder.status)}
                              <span className="text-[9px] text-slate-400 block font-mono">({row.messages.paymentReminder.count} sent)</span>
                            </div>
                          ) : (
                            renderStatusBadge(row.messages.paymentReminder.status, row.messages.paymentReminder.reasonIfMissing)
                          )}
                        </td>

                        {/* Payment Confirmation */}
                        <td className="py-3 px-3">
                          {renderStatusBadge(row.messages.paymentConfirmed.status, row.messages.paymentConfirmed.reasonIfMissing)}
                        </td>

                        {/* 48h Invitation */}
                        <td className="py-3 px-3">
                          {renderStatusBadge(row.messages.invitation48h.status, row.messages.invitation48h.reasonIfMissing)}
                        </td>

                        {/* 24h Reminder */}
                        <td className="py-3 px-3">
                          {renderStatusBadge(row.messages.reminder24h.status, row.messages.reminder24h.reasonIfMissing)}
                        </td>

                        {/* Feedback */}
                        <td className="py-3 px-3">
                          {renderStatusBadge(row.messages.feedback.status, row.messages.feedback.reasonIfMissing)}
                        </td>

                        {/* Last Comm */}
                        <td className="py-3 px-3">
                          {row.lastCommunication ? (
                            <div className="text-[10px]">
                              <span className="font-bold text-slate-800 capitalize block">
                                {row.lastCommunication.messageType.replace(/_/g, ' ')}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {new Date(row.lastCommunication.at).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>

                        {/* Overall Health */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              row.health === 'HEALTHY'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : row.health === 'ACTION_NEEDED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {row.health.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Action Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPersonDrawer(row.inquiryId);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Timeline"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>
                Showing page <strong className="text-slate-800">{pagination.page}</strong> of <strong className="text-slate-800">{pagination.totalPages}</strong> ({pagination.total} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchRegistrations(selectedEventId, pagination.page - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchRegistrations(selectedEventId, pagination.page + 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSON COMMUNICATION TIMELINE DRAWER / MODAL */}
      {/* ========================================================================= */}
      {selectedInquiryId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{timelineData?.customerName || selectedInquiryId}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                    <span>{timelineData?.inquiryId}</span> &bull; <span>{timelineData?.phoneNumberMasked}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedInquiryId(null);
                    setTimelineData(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Summary Stats Badges */}
              {timelineData?.totals && (
                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Attempted</span>
                    <span className="text-sm font-extrabold text-slate-900">{timelineData.totals.attempted}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-teal-700 block">Delivered</span>
                    <span className="text-sm font-extrabold text-teal-800">{timelineData.totals.delivered}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-emerald-700 block">Read</span>
                    <span className="text-sm font-extrabold text-emerald-800">{timelineData.totals.read}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-rose-700 block">Failed</span>
                    <span className="text-sm font-extrabold text-rose-800">{timelineData.totals.failed}</span>
                  </div>
                </div>
              )}

              {/* Resend Status Banner */}
              {resendStatus && (
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800">
                  {resendStatus}
                </div>
              )}

              {/* Chronological Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Communication History &amp; Timestamp Journey:
                </h4>

                {loadingTimeline ? (
                  <div className="py-8 text-center text-xs text-slate-500 font-medium">
                    Loading timeline...
                  </div>
                ) : timelineData?.timeline.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    No WhatsApp messages dispatched yet for this couple.
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {timelineData?.timeline.map((msg) => (
                      <div key={msg.id} className="relative pl-8 space-y-1.5">
                        <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-400" />
                        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-900 capitalize">
                              {msg.templateName}
                            </span>
                            {renderStatusBadge(msg.status)}
                          </div>

                          <div className="text-[10px] text-slate-500 font-mono space-y-0.5">
                            <div><strong>Trigger:</strong> {msg.trigger} &bull; <strong>Type:</strong> {msg.messageType}</div>
                            {msg.sentAt && <div><strong>Sent:</strong> {new Date(msg.sentAt).toLocaleString('en-IN')}</div>}
                            {msg.deliveredAt && <div><strong>Delivered:</strong> {new Date(msg.deliveredAt).toLocaleString('en-IN')}</div>}
                            {msg.readAt && <div><strong>Read:</strong> {new Date(msg.readAt).toLocaleString('en-IN')}</div>}
                            {msg.failedAt && <div className="text-rose-700"><strong>Failed:</strong> {new Date(msg.failedAt).toLocaleString('en-IN')} ({msg.lastErrorMessage || 'Error'})</div>}
                            {msg.providerMessageId && <div className="truncate text-slate-400"><strong>wamid:</strong> {msg.providerMessageId}</div>}
                          </div>

                          <div className="pt-2 border-t border-slate-200 flex justify-end">
                            <button
                              disabled={resendingKey === msg.templateName}
                              onClick={() => handleResend(timelineData.inquiryId, msg.templateName)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            >
                              {resendingKey === msg.templateName ? 'Resending...' : 'Resend Message ↺'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedInquiryId(null);
                setTimelineData(null);
              }}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Close Ledger
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BROADCAST MODAL */}
      {/* ========================================================================= */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <MessageCircleIcon className="w-4 h-4 text-rose-700" />
                <span>Launch Event Broadcast</span>
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Target Audience:</label>
                <select
                  value={broadcastAudience}
                  onChange={(e) => {
                    setBroadcastAudience(e.target.value as any);
                    setTimeout(handlePreviewBroadcast, 50);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  <option value="ALL_CONFIRMED">All Confirmed Attendees (Paid / Active Pass)</option>
                  <option value="PAYMENT_PENDING">Payment Pending Couples Only</option>
                  <option value="ATTENDED">Verified Attended Attendees (Present at Gate)</option>
                </select>
              </div>

              {/* Preview Box */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Audience Verification Preview:</span>
                {previewingBroadcast ? (
                  <span className="text-slate-500 font-medium">Calculating recipients...</span>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Total Pool</span>
                      <strong className="text-slate-800 text-sm">{broadcastPreview?.totalRegistrations ?? 0}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-rose-700 block">Opted Out</span>
                      <strong className="text-rose-800 text-sm">{broadcastPreview?.optedOutCount ?? 0}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-700 block">Final Recipients</span>
                      <strong className="text-emerald-800 text-sm">{broadcastPreview?.finalRecipientCount ?? 0}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Meta Template:</label>
                <select
                  value={broadcastTemplateKey}
                  onChange={(e) => setBroadcastTemplateKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  <option value="edkl_event_update_v1">edkl_event_update_v1 (Event Update Notification)</option>
                  <option value="edkl_event_reminder_v1">edkl_event_reminder_v1 (Event Reminder)</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Custom Message / Detail (Optional):</label>
                <textarea
                  rows={3}
                  value={broadcastCustomMsg}
                  onChange={(e) => setBroadcastCustomMsg(e.target.value)}
                  placeholder="e.g. Please arrive 15 minutes before seminar time at Gate 2."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={sendingBroadcast || !broadcastPreview?.finalRecipientCount}
                onClick={handleSendBroadcast}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                {sendingBroadcast ? 'Queueing Messages...' : `Confirm & Queue (${broadcastPreview?.finalRecipientCount || 0})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GALLERY READY MODAL */}
      {/* ========================================================================= */}
      {showGalleryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Publish Event Photo Gallery</h3>
              <button onClick={() => setShowGalleryModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 font-medium">
                Dispatches gallery access link to all verified seminar attendees (Gate attendance verified).
              </p>
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Gallery URL:</label>
                <input
                  type="text"
                  value={galleryUrl}
                  onChange={(e) => setGalleryUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowGalleryModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={sendingGallery}
                onClick={handleTriggerGallery}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                {sendingGallery ? 'Queueing...' : 'Dispatch Gallery Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEMPLATES & TEST SENDER */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Test Sender Form */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-rose-700" />
              <span>Direct Meta WhatsApp Sandbox &amp; Live Test Sender</span>
            </h3>

            <form onSubmit={handleSendTestMessage} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Select Registered Couple:</label>
                <select
                  value={selectedSubmissionId}
                  onChange={(e) => {
                    setSelectedSubmissionId(e.target.value);
                    const sub = submissions.find(s => (s._id || s.inquiryId) === e.target.value);
                    if (sub) {
                      setCustomPhone(sub.phoneNumber || '');
                      setCustomName(`${sub.husbandName} & ${sub.wifeName}`);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  {submissions.map((s) => (
                    <option key={s._id || s.inquiryId} value={s._id || s.inquiryId}>
                      {s.husbandName} &amp; {s.wifeName} ({s.inquiryId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Recipient Phone Number:</label>
                <input
                  type="text"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Template to Test:</label>
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  {metaTemplates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.metaName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex items-center justify-between pt-2 border-t border-slate-100">
                {dispatchResult && (
                  <span className={`text-xs font-bold ${dispatchResult.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {dispatchResult.message}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="ml-auto px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  {sendingTest ? 'Sending via Meta API...' : 'Send Live Test Message'}
                </button>
              </div>
            </form>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metaTemplates.map((t) => (
              <div key={t.key} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="font-mono font-extrabold text-xs text-slate-900">{t.metaName}</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold rounded uppercase border border-emerald-200">
                    APPROVED
                  </span>
                </div>
                <div className="bg-[#EFEAE2] p-3 rounded-2xl border border-[#DDD6C8] text-xs leading-relaxed text-slate-900 shadow-inner">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    {t.bodyText}
                  </div>
                </div>
                {t.buttons && t.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {t.buttons.map((b, idx) => (
                      <span key={idx} className="px-3 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold">
                        🔗 {b.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DELIVERY AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Meta Delivery Webhook Activity Ledger</h3>
              <p className="text-xs text-slate-500 font-medium">Real-time status updates from Meta Graph API webhook callbacks.</p>
            </div>
            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer"
            >
              {loadingLogs ? 'Refreshing...' : 'Refresh Logs'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Recipient Phone</th>
                  <th className="py-2.5 px-3">Inquiry ID</th>
                  <th className="py-2.5 px-3">Template</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Meta Message ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-[11px] text-slate-500">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{log.recipientPhone}</td>
                    <td className="py-2.5 px-3 font-mono font-extrabold text-rose-700">{log.inquiryId || '-'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{log.templateName}</td>
                    <td className="py-2.5 px-3">{renderStatusBadge(log.status)}</td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                      {log.providerMessageId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
