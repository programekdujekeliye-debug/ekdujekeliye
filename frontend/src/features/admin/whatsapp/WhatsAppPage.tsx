'use client';

import React, { useState, useEffect } from 'react';
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
  EyeIcon,
  ActivityIcon,
  FileTextIcon,
  CameraIcon,
  ExternalLinkIcon,
  UsersIcon,
  XIcon
} from '../../../components/Icons';
import { WhatsAppInbox } from './WhatsAppInbox';
import { LuxurySelect, SelectOption } from '../../../components/LuxurySelect';
import toast from 'react-hot-toast';

export const WhatsAppPage = () => {
  // Navigation Sub-tabs: 'dashboard' | 'inbox' | 'templates' | 'logs'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'templates' | 'logs'>('dashboard');
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

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

  // Post-Event Communication Modal
  const [showPostEventModal, setShowPostEventModal] = useState(false);
  const [postEventStatus, setPostEventStatus] = useState<any>(null);
  const [loadingPostEventStatus, setLoadingPostEventStatus] = useState(false);
  const [sendingPostEvent, setSendingPostEvent] = useState(false);
  const [postEventGalleryUrl, setPostEventGalleryUrl] = useState('https://www.ekdujekeliye.in/gallery');

  // Specific Bulk Numbers Modal
  const [showSpecificBroadcastModal, setShowSpecificBroadcastModal] = useState(false);
  const [rawSpecificNumbers, setRawSpecificNumbers] = useState('');
  const [specificBroadcastMode, setSpecificBroadcastMode] = useState<'TEMPLATE' | 'FREE_TEXT'>('TEMPLATE');
  const [specificBroadcastTemplate, setSpecificBroadcastTemplate] = useState('edkl_event_update_v1');
  const [specificBroadcastMessage, setSpecificBroadcastMessage] = useState('');
  const [specificPreviewData, setSpecificPreviewData] = useState<any>(null);
  const [loadingSpecificPreview, setLoadingSpecificPreview] = useState(false);
  const [sendingSpecificBroadcast, setSendingSpecificBroadcast] = useState(false);

  // Gallery Modal (Legacy Fallback)
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState('https://www.ekdujekeliye.in/gallery');
  const [sendingGallery, setSendingGallery] = useState(false);

  // Templates Tab State (Manual Test Tool)
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const [customPhone, setCustomPhone] = useState('918320594829');
  const [customName, setCustomName] = useState('Jaynesh & Partner');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('edkl_payment_confirmed_pass_v2');
  const [sendingTest, setSendingTest] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Logs Tab State
  const [logs, setLogs] = useState<WhatsappLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');

  // Queue Worker Trigger State
  const [runningWorker, setRunningWorker] = useState(false);

  const handleRunWorker = async () => {
    setRunningWorker(true);
    try {
      const res = await whatsappApi.runWorker();
      if (res?.success) {
        const summary = res.summary || {};
        toast.success(`Queue worker dispatched. Sent: ${summary.sent ?? 0}, Processed: ${summary.processed ?? 0}`);
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
        health: healthFilter
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
  }, [selectedEventId, paymentFilter, healthFilter]);

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
      toast.success(`Broadcast queued (${res.queuedCount} messages scheduled).`);
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
      toast.success(`Gallery link queued for ${res.queuedCount} participants.`);
      setShowGalleryModal(false);
      fetchDashboardData(selectedEventId);
      fetchRegistrations(selectedEventId, pagination.page);
    } catch (err: any) {
      toast.error(`Failed to trigger gallery: ${err.message}`);
    } finally {
      setSendingGallery(false);
    }
  };

  // Open Post-Event Communication Modal & Check Midnight Readiness
  const handleOpenPostEventModal = async () => {
    if (!selectedEventId || selectedEventId === 'all') {
      toast.error('Please select a specific event slot first.');
      return;
    }
    setShowPostEventModal(true);
    setLoadingPostEventStatus(true);
    try {
      const res = await whatsappApi.getPostEventStatus(selectedEventId);
      setPostEventStatus(res);
      if (res.defaultGalleryUrl) setPostEventGalleryUrl(res.defaultGalleryUrl);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch post-event readiness status');
    } finally {
      setLoadingPostEventStatus(false);
    }
  };

  // Dispatch Combined Post-Event Memories + Feedback
  const handleSendPostEvent = async () => {
    if (!selectedEventId) return;
    if (!confirm('Confirm dispatching combined memories + feedback WhatsApp to all PRESENT attendees?')) return;
    setSendingPostEvent(true);
    try {
      const res = await whatsappApi.triggerPostEventSend(selectedEventId, {
        galleryUrl: postEventGalleryUrl,
        forceSend: false
      });
      toast.success(res.message || 'Post-event communications queued successfully.');
      setShowPostEventModal(false);
      fetchDashboardData(selectedEventId);
      fetchRegistrations(selectedEventId, pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch post-event communications');
    } finally {
      setSendingPostEvent(false);
    }
  };

  // Preview Specific Numbers Bulk Audience
  const handlePreviewSpecific = async () => {
    if (!selectedEventId || selectedEventId === 'all') {
      toast.error('Please select an event slot first.');
      return;
    }
    if (!rawSpecificNumbers.trim()) {
      toast.error('Please enter at least one phone number.');
      return;
    }
    setLoadingSpecificPreview(true);
    try {
      const res = await whatsappApi.previewSpecificBroadcast({
        eventId: selectedEventId,
        rawNumbers: rawSpecificNumbers,
        messageMode: specificBroadcastMode,
        templateKey: specificBroadcastTemplate
      });
      setSpecificPreviewData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to preview audience');
    } finally {
      setLoadingSpecificPreview(false);
    }
  };

  // Dispatch Specific Bulk Broadcast
  const handleSendSpecific = async () => {
    if (!selectedEventId) return;
    if (!specificPreviewData || specificPreviewData.eligibleCount === 0) {
      toast.error('No eligible recipients to send to.');
      return;
    }
    if (!confirm(`Confirm sending to ${specificPreviewData.eligibleCount} recipients?`)) return;
    setSendingSpecificBroadcast(true);
    try {
      const res = await whatsappApi.sendSpecificBroadcast({
        eventId: selectedEventId,
        rawNumbers: rawSpecificNumbers,
        messageMode: specificBroadcastMode,
        templateKey: specificBroadcastTemplate,
        customMessage: specificBroadcastMessage
      });
      toast.success(res.message || 'Broadcast queued successfully.');
      setShowSpecificBroadcastModal(false);
      setRawSpecificNumbers('');
      setSpecificPreviewData(null);
      fetchDashboardData(selectedEventId);
      fetchRegistrations(selectedEventId, pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch broadcast');
    } finally {
      setSendingSpecificBroadcast(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await whatsappApi.getLogs(100);
      if (res && res.logs) setLogs(res.logs);
    } catch (err) {
      console.error('Failed to refresh logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchInboxStats = async () => {
    try {
      const res = await whatsappApi.getConversationStats();
      if (res.success && res.stats) {
        setInboxUnreadCount(res.stats.unreadCount || 0);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchInboxStats();
    const interval = setInterval(fetchInboxStats, 15000);
    return () => clearInterval(interval);
  }, []);

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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200">
          READ
        </span>
      );
    }
    if (s === 'DELIVERED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          DELIVERED
        </span>
      );
    }
    if (s === 'SENT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
          SENT
        </span>
      );
    }
    if (s === 'QUEUED' || s === 'SCHEDULED' || s === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
          {s}
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
          FAILED
        </span>
      );
    }
    if (s === 'NOT_REQUIRED') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
          NOT REQUIRED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-50 text-slate-400 border border-slate-200" title={reasonIfMissing || 'Not sent'}>
        {reasonIfMissing ? reasonIfMissing.replace(/_/g, ' ') : 'NOT SENT'}
      </span>
    );
  };

  const summary = dashboardData?.summary;
  const activeTemplateObj = metaTemplates.find(t => t.key === selectedTemplateKey);

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    if (logStatusFilter !== 'ALL' && log.status !== logStatusFilter) return false;
    if (logSearch) {
      const q = logSearch.toLowerCase();
      return (
        log.recipientPhone?.toLowerCase().includes(q) ||
        log.inquiryId?.toLowerCase().includes(q) ||
        log.templateName?.toLowerCase().includes(q) ||
        log.providerMessageId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* ========================================================================= */}
      {/* 1. TOP EDKL THEMED COMMAND HEADER & SUB-NAVIGATION */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shadow-xs flex-shrink-0">
            <WhatsappIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">WhatsApp Telemetry &amp; Support Hub</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Cloud API v26.0
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live delivery ledger, automated queue monitor, two-way support chat, and broadcast engine.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto overflow-x-auto scrollbar-none w-full md:w-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-1 md:flex-none justify-center ${
              activeTab === 'dashboard'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ActivityIcon className="w-3.5 h-3.5" />
            <span>Event Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-1 md:flex-none justify-center ${
              activeTab === 'inbox'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <MessageCircleIcon className="w-3.5 h-3.5" />
            <span>Support Inbox</span>
            {inboxUnreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-white text-rose-700 rounded-full text-[10px] font-black shadow-xs">
                {inboxUnreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-1 md:flex-none justify-center ${
              activeTab === 'templates'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileTextIcon className="w-3.5 h-3.5" />
            <span>Templates &amp; Sandbox</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-1 md:flex-none justify-center ${
              activeTab === 'logs'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5" />
            <span>Live Audit Logs</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EVENT COMMUNICATION DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Event Selector & Actions Strip */}
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0 flex-1 max-w-xl">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                Active Seminar / Slot:
              </span>
              <div className="flex-1 min-w-[280px] sm:min-w-[340px]">
                <LuxurySelect
                  value={selectedEventId}
                  onChange={(val) => setSelectedEventId(val)}
                  options={[
                    { value: 'all', label: 'All Seminar Slots (Global Overview)' },
                    ...events.map((evt) => ({
                      value: evt.id || (evt as any)._id,
                      label: `${evt.name} — ${evt.city}`,
                      badge: evt.date || 'TBA',
                      sublabel: evt.venue
                    }))
                  ]}
                  placeholder="Select Seminar Slot..."
                  searchable
                  variant="card"
                  size="md"
                />
              </div>
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
                <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin text-rose-600' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => {
                  setShowBroadcastModal(true);
                  handlePreviewBroadcast();
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageCircleIcon className="w-3.5 h-3.5" />
                <span>Audience Broadcast</span>
              </button>

              <button
                onClick={() => {
                  setShowSpecificBroadcastModal(true);
                  setSpecificPreviewData(null);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Send WhatsApp message to specific attendee phone numbers"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>Specific Numbers</span>
              </button>

              <button
                onClick={handleOpenPostEventModal}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Review post-event readiness and dispatch combined memories + feedback"
              >
                <CameraIcon className="w-3.5 h-3.5" />
                <span>Post-Event Communication</span>
              </button>
            </div>
          </div>

          {/* Bento KPI Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Registrations */}
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Registrations</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {summary?.totalRegistrations ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                <span className="text-emerald-700 font-extrabold">{summary?.confirmedRegistrations ?? 0} Paid</span> &bull; {summary?.paymentPendingRegistrations ?? 0} Pending
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full"
                  style={{
                    width: `${summary?.totalRegistrations ? ((summary.confirmedRegistrations || 0) / summary.totalRegistrations) * 100 : 0}%`
                  }}
                />
                <div
                  className="bg-amber-500 h-full"
                  style={{
                    width: `${summary?.totalRegistrations ? ((summary.paymentPendingRegistrations || 0) / summary.totalRegistrations) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* 2. Messages Sent */}
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Dispatched</span>
              <div className="text-xl sm:text-2xl font-black text-blue-700">
                {summary?.totalMessagesSent ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Meta accepted wamid
              </div>
              <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-full" />
              </div>
            </div>

            {/* 3. Delivered */}
            <div className="bg-white border border-emerald-200 bg-emerald-50/30 rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-1.5">
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">Delivered</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">
                {summary?.totalMessagesDelivered ?? 0}
              </div>
              <div className="text-[10px] text-emerald-700 font-bold">
                {summary?.deliveryRate ?? 0}% Delivery Rate
              </div>
              <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full" style={{ width: `${summary?.deliveryRate || 0}%` }} />
              </div>
            </div>

            {/* 4. Read */}
            <div className="bg-white border border-sky-200 bg-sky-50/30 rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-1.5">
              <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-wider block">Read (Opened)</span>
              <div className="text-xl sm:text-2xl font-black text-sky-700">
                {summary?.totalMessagesRead ?? 0}
              </div>
              <div className="text-[10px] text-sky-700 font-bold">
                {summary?.readRate ?? 0}% of delivered
              </div>
              <div className="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden">
                <div className="bg-sky-600 h-full" style={{ width: `${summary?.readRate || 0}%` }} />
              </div>
            </div>

            {/* 5. Failed */}
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Failed</span>
              <div className={`text-xl sm:text-2xl font-black ${(summary?.totalMessagesFailed ?? 0) > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                {summary?.totalMessagesFailed ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {(summary?.totalMessagesFailed ?? 0) === 0 ? '0% Failure Rate' : `${summary?.failureRate}% Failure Rate`}
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full" style={{ width: `${summary?.failureRate || 0}%` }} />
              </div>
            </div>

            {/* 6. Action Needed */}
            <div
              onClick={() => setHealthFilter(healthFilter === 'ACTION_NEEDED' ? 'ALL' : 'ACTION_NEEDED')}
              className={`border rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-1.5 cursor-pointer transition-all ${
                healthFilter === 'ACTION_NEEDED'
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/30'
                  : 'bg-white border-slate-200 hover:border-rose-300'
              }`}
            >
              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block flex items-center justify-between">
                <span>Action Needed</span>
                {healthFilter === 'ACTION_NEEDED' && <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">FILTER ON</span>}
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-700">
                {summary?.actionNeededCount ?? 0}
              </div>
              <div className="text-[10px] text-rose-600 font-medium">
                Failed dispatches
              </div>
              <div className="w-full h-1.5 bg-rose-100 rounded-full overflow-hidden">
                <div className="bg-rose-600 h-full w-full" />
              </div>
            </div>
          </div>

          {/* Event WhatsApp Status (5 Core Stages) */}
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <ActivityIcon className="w-4 h-4 text-rose-700" />
                  <span>Event WhatsApp Status</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Automated milestone dispatch, delivery rate, and read funnel across the 5 core lifecycle stages.</p>
              </div>
              {summary?.totalMessagesScheduled ? (
                <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-bold self-start sm:self-auto flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5 text-amber-700" />
                  <span>{summary.totalMessagesScheduled} pending in queue</span>
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto touch-scroll">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-2.5 text-center">Eligible</th>
                    <th className="py-2.5 px-2.5 text-center">Delivered</th>
                    <th className="py-2.5 px-2.5 text-center">Read</th>
                    <th className="py-2.5 px-2.5 text-center">Failed</th>
                    <th className="py-2.5 px-2.5 text-center">Waiting (Queued)</th>
                    <th className="py-2.5 px-3">Delivery Rate</th>
                    <th className="py-2.5 px-3">Read Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {[
                    { key: 'payment_pending', label: 'Payment Reminder', eligible: summary?.paymentPendingRegistrations ?? 0, stats: dashboardData?.messageTypeStats?.['payment_pending'] },
                    { key: 'payment_confirmation', label: 'Payment Confirmed', eligible: summary?.confirmedRegistrations ?? 0, stats: dashboardData?.messageTypeStats?.['payment_confirmation'] || dashboardData?.messageTypeStats?.['pass_delivery'] },
                    { key: 'reminder', label: '48h Pass Reminder', eligible: summary?.confirmedRegistrations ?? 0, stats: dashboardData?.messageTypeStats?.['reminder'] },
                    { key: 'invitation', label: '24h Invitation (Image Header)', eligible: summary?.confirmedRegistrations ?? 0, stats: dashboardData?.messageTypeStats?.['invitation'] },
                    { key: 'post_event', label: 'Post Event (Photos + Feedback)', eligible: summary?.attendedRegistrations ?? 0, stats: dashboardData?.messageTypeStats?.['post_event'] || dashboardData?.messageTypeStats?.['gallery_ready'] || dashboardData?.messageTypeStats?.['feedback_request'] }
                  ].map((row) => {
                    const m = row.stats || { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, deliveryRate: 0, readRate: 0 };
                    return (
                      <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-600">{row.eligible}</td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-emerald-700">{m.delivered}</td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-sky-700">{m.read}</td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-rose-700">{m.failed}</td>
                        <td className="py-2.5 px-2.5 text-center">
                          {m.queued > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[10px]">
                              {m.queued} queued
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-700 w-8">{m.deliveryRate}%</span>
                            <div className="flex-1 max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="bg-emerald-600 h-full" style={{ width: `${m.deliveryRate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sky-700 w-8">{m.readRate}%</span>
                            <div className="flex-1 max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="bg-sky-600 h-full" style={{ width: `${m.readRate}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registrations Communication Ledger */}
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-rose-600" />
                  <span>Attendee Communication Ledger</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Per-couple real-time delivery state, payment status, and timeline drawer.</p>
              </div>

              {/* Multi Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative flex-1 sm:flex-none">
                  <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search couple name, phone, EK-ID..."
                    className="w-full sm:w-auto pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500 min-w-[220px]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Clear search"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="w-[140px]">
                  <LuxurySelect
                    value={paymentFilter}
                    onChange={(val) => setPaymentFilter(val as any)}
                    options={[
                      { value: 'ALL', label: 'Payment: All' },
                      { value: 'PAID', label: 'PAID Only', badge: 'PAID' },
                      { value: 'PENDING', label: 'PENDING Only', badge: 'PENDING' }
                    ]}
                    placeholder="Payment..."
                    variant="card"
                    size="sm"
                  />
                </div>

                <div className="w-[155px]">
                  <LuxurySelect
                    value={healthFilter}
                    onChange={(val) => setHealthFilter(val as any)}
                    options={[
                      { value: 'ALL', label: 'Health: All' },
                      { value: 'HEALTHY', label: 'HEALTHY', badge: 'OK' },
                      { value: 'ACTION_NEEDED', label: 'ACTION NEEDED', badge: 'FAIL' },
                      { value: 'IN_PROGRESS', label: 'IN PROGRESS', badge: 'QUEUE' }
                    ]}
                    placeholder="Health..."
                    variant="card"
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                    <th className="py-2.5 px-3">Couple / Inquiry</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3">Pass</th>
                    <th className="py-2.5 px-3">Payment Reminder</th>
                    <th className="py-2.5 px-3">Payment Confirmed</th>
                    <th className="py-2.5 px-3">48h Pass Reminder</th>
                    <th className="py-2.5 px-3">24h Invitation</th>
                    <th className="py-2.5 px-3">Post Event</th>
                    <th className="py-2.5 px-3">Health</th>
                    <th className="py-2.5 px-3 text-center">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {loadingRegistrations ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                        <RefreshCwIcon className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-600" />
                        Loading attendee ledger...
                      </td>
                    </tr>
                  ) : registrations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                        No attendees match current filters.
                      </td>
                    </tr>
                  ) : (
                    registrations.map((row) => (
                      <tr
                        key={row.inquiryId}
                        onClick={() => openPersonDrawer(row.inquiryId)}
                        className="hover:bg-rose-50/40 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                              {(row.coupleName || 'WG').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 block leading-tight">{row.coupleName}</span>
                              <span className="text-[10px] font-mono text-rose-700 font-bold">{row.inquiryId}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-slate-600">{row.maskedPhone}</td>

                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            row.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {row.paymentStatus}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-[10px] font-bold">
                          {row.passStatus === 'ACTIVE' ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-slate-400">{row.passStatus}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">{renderStatusBadge(row.messages?.paymentReminder?.status, row.messages?.paymentReminder?.reasonIfMissing)}</td>
                        <td className="py-2.5 px-3">{renderStatusBadge(row.messages?.paymentConfirmed?.status, row.messages?.paymentConfirmed?.reasonIfMissing)}</td>
                        <td className="py-2.5 px-3">{renderStatusBadge((row.messages as any)?.passReminder48h?.status || row.messages?.reminder24h?.status, (row.messages as any)?.passReminder48h?.reasonIfMissing || row.messages?.reminder24h?.reasonIfMissing)}</td>
                        <td className="py-2.5 px-3">{renderStatusBadge((row.messages as any)?.invitation24h?.status || row.messages?.invitation48h?.status, (row.messages as any)?.invitation24h?.reasonIfMissing || row.messages?.invitation48h?.reasonIfMissing)}</td>
                        <td className="py-2.5 px-3">{renderStatusBadge((row.messages as any)?.postEvent?.status || row.messages?.feedback?.status, (row.messages as any)?.postEvent?.reasonIfMissing || row.messages?.feedback?.reasonIfMissing)}</td>

                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            row.health === 'ACTION_NEEDED'
                              ? 'bg-rose-50 text-rose-800 border border-rose-300'
                              : (row.health === 'WAITING' || (row.health as any) === 'PENDING')
                              ? 'bg-amber-50 text-amber-800 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          }`}>
                            {row.health === 'ACTION_NEEDED' ? 'ACTION NEEDED' : (row.health === 'WAITING' || (row.health as any) === 'PENDING') ? 'WAITING' : 'GOOD'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openPersonDrawer(row.inquiryId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                            title="Open Timeline"
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

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
              <span>
                Showing {registrations.length} of {pagination.total} registrations
              </span>
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchRegistrations(selectedEventId, pagination.page - 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg disabled:opacity-40 cursor-pointer font-bold"
                >
                  Previous
                </button>
                <span className="px-2 font-bold text-slate-800">
                  Page {pagination.page} / {pagination.totalPages || 1}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchRegistrations(selectedEventId, pagination.page + 1)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg disabled:opacity-40 cursor-pointer font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TWO-WAY SUPPORT INBOX */}
      {/* ========================================================================= */}
      {activeTab === 'inbox' && (
        <WhatsAppInbox
          events={events}
          metaTemplates={metaTemplates}
          onOpenTimeline={openPersonDrawer}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TEMPLATES & TEST SENDER (WITH LIVE WHATSAPP PHONE SIMULATOR) */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Test Sender Controls */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4 text-rose-600" />
                  <span>Meta WhatsApp Sandbox &amp; Live Test Dispatcher</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Send real-time test messages to any registered attendee or staff test phone.
                </p>
              </div>

              <form onSubmit={handleSendTestMessage} className="space-y-4 text-xs">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1.5">Select Registered Couple (Auto-fill):</label>
                  <LuxurySelect
                    value={selectedSubmissionId}
                    onChange={(val) => {
                      setSelectedSubmissionId(val);
                      const sub = submissions.find(s => (s._id || s.inquiryId) === val);
                      if (sub) {
                        setCustomPhone(sub.phoneNumber || '');
                        setCustomName(`${sub.husbandName} & ${sub.wifeName}`);
                      }
                    }}
                    options={submissions.map((s) => ({
                      value: s._id || s.inquiryId,
                      label: `${s.husbandName} & ${s.wifeName}`,
                      badge: s.inquiryId,
                      sublabel: `Phone: ${s.phoneNumber}`
                    }))}
                    placeholder="Choose registered couple..."
                    searchable
                    variant="card"
                    size="md"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1.5">Recipient Phone Number (with 91):</label>
                    <input
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1.5">Customer / Couple Name:</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1.5">Meta Approved Template:</label>
                  <LuxurySelect
                    value={selectedTemplateKey}
                    onChange={(val) => setSelectedTemplateKey(val)}
                    options={metaTemplates.map((t) => ({
                      value: t.key,
                      label: t.metaName,
                      badge: t.category,
                      sublabel: t.purpose || t.trigger
                    }))}
                    placeholder="Select Meta approved template..."
                    searchable
                    variant="card"
                    size="md"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  {dispatchResult && (
                    <span className={`text-xs font-bold ${dispatchResult.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {dispatchResult.message}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={sendingTest}
                    className="sm:ml-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {sendingTest ? 'Dispatching via Meta API...' : 'Send Live Test Message'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Live WhatsApp Device Simulator */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col items-center justify-center">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-3">Live WhatsApp Preview</span>
              
              {/* Phone Frame */}
              <div className="w-[280px] sm:w-[300px] bg-[#EFEAE2] border-8 border-slate-800 rounded-[36px] shadow-lg overflow-hidden flex flex-col h-[460px] relative">
                {/* Phone Top Notch */}
                <div className="bg-slate-800 h-5 w-full flex items-center justify-center">
                  <div className="w-14 h-2 bg-slate-900 rounded-full" />
                </div>

                {/* WhatsApp Chat Header */}
                <div className="bg-[#075E54] text-white p-2.5 flex items-center gap-2 shadow-xs">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black">
                    ED
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs block truncate">Ek Duje Ke Liye</span>
                    <span className="text-[9px] text-emerald-200 block">Official Business Account</span>
                  </div>
                </div>

                {/* Chat Bubble Canvas */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-xs text-[11px] leading-relaxed text-slate-800 space-y-2 border border-slate-200">
                    <p className="whitespace-pre-wrap">
                      {activeTemplateObj?.bodyText?.replace(/\{\{1\}\}/g, customName) || 'Select a template...'}
                    </p>
                    <span className="text-[9px] text-slate-400 block text-right font-mono">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {activeTemplateObj?.buttons?.map((b, idx) => (
                    <div key={idx} className="bg-white/95 text-sky-700 font-bold text-[10px] p-2 rounded-xl text-center shadow-xs border border-slate-200 flex items-center justify-center gap-1">
                      <ExternalLinkIcon className="w-3 h-3 text-sky-600" />
                      <span>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Template Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metaTemplates.map((t) => (
              <div key={t.key} className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-mono font-extrabold text-xs text-slate-900">{t.metaName}</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[9px] font-black rounded uppercase border border-emerald-200">
                    APPROVED
                  </span>
                </div>
                <div className="bg-[#EFEAE2]/60 p-3 rounded-2xl border border-[#DDD6C8] text-xs text-slate-800 shadow-inner">
                  <p className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs leading-relaxed whitespace-pre-wrap">
                    {t.bodyText}
                  </p>
                </div>
                {t.buttons && t.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.buttons.map((b, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1">
                        <ExternalLinkIcon className="w-2.5 h-2.5 text-slate-500" />
                        <span>{b.text}</span>
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
      {/* TAB 4: DELIVERY AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Meta Delivery Webhook Activity Ledger
              </h3>
              <p className="text-xs text-slate-500 font-medium">Real-time status updates received directly from Meta Graph API webhook listeners.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search logs..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="w-[140px]">
                <LuxurySelect
                  value={logStatusFilter}
                  onChange={(val) => setLogStatusFilter(val)}
                  options={[
                    { value: 'ALL', label: 'Status: All' },
                    { value: 'SENT', label: 'SENT', badge: 'SENT' },
                    { value: 'DELIVERED', label: 'DELIVERED', badge: 'DLVD' },
                    { value: 'READ', label: 'READ', badge: 'READ' },
                    { value: 'FAILED', label: 'FAILED', badge: 'FAIL' }
                  ]}
                  placeholder="Status..."
                  variant="card"
                  size="sm"
                />
              </div>

              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-rose-600' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto touch-scroll">
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
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{log.recipientPhone}</td>
                    <td className="py-2.5 px-3 font-mono font-extrabold text-rose-700">{log.inquiryId || '-'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{log.templateName}</td>
                    <td className="py-2.5 px-3">{renderStatusBadge(log.status)}</td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[180px]">
                      {log.providerMessageId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSON TIMELINE SLIDE-OVER DRAWER */}
      {/* ========================================================================= */}
      {selectedInquiryId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl p-4 sm:p-6 overflow-y-auto space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header */}
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

              {/* Summary Stats Badges */}
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

              {/* Resend Status Banner */}
              {resendStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold">
                  {resendStatus}
                </div>
              )}

              {/* Timeline Flow */}
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

      {/* ========================================================================= */}
      {/* BROADCAST MODAL */}
      {/* ========================================================================= */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                <MessageCircleIcon className="w-4 h-4 text-rose-600" />
                <span>Launch Event Broadcast</span>
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Target Audience:</label>
                <LuxurySelect
                  value={broadcastAudience}
                  onChange={(val) => {
                    setBroadcastAudience(val as any);
                    setTimeout(handlePreviewBroadcast, 50);
                  }}
                  options={[
                    { value: 'ALL_CONFIRMED', label: 'All Confirmed Attendees', badge: 'PAID / ACTIVE PASS' },
                    { value: 'PAYMENT_PENDING', label: 'Payment Pending Couples Only', badge: 'PENDING' },
                    { value: 'ATTENDED', label: 'Verified Attended Attendees', badge: 'PRESENT AT GATE' }
                  ]}
                  placeholder="Choose audience..."
                  variant="card"
                  size="md"
                />
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
                <LuxurySelect
                  value={broadcastTemplateKey}
                  onChange={(val) => setBroadcastTemplateKey(val)}
                  options={[
                    { value: 'edkl_event_update_v1', label: 'edkl_event_update_v1', badge: 'EVENT UPDATE', sublabel: 'Event Update Notification' },
                    { value: 'edkl_event_pass_reminder_v2', label: 'edkl_event_pass_reminder_v2', badge: 'REMINDER', sublabel: '48h Pass Reminder' }
                  ]}
                  placeholder="Choose template..."
                  variant="card"
                  size="md"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Custom Message / Detail (Optional):</label>
                <textarea
                  rows={3}
                  value={broadcastCustomMsg}
                  onChange={(e) => setBroadcastCustomMsg(e.target.value)}
                  placeholder="e.g. Please arrive 15 minutes before seminar time at Gate 2."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
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
      {/* POST-EVENT COMMUNICATION MODAL */}
      {/* ========================================================================= */}
      {showPostEventModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <CameraIcon className="w-4 h-4 text-rose-600" />
                  <span>Post-Event Communication (Memories & Feedback)</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Single combined WhatsApp with Photo Gallery URL button and Feedback Form URL button.
                </p>
              </div>
              <button onClick={() => setShowPostEventModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {loadingPostEventStatus ? (
              <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <RefreshCwIcon className="w-4 h-4 animate-spin text-rose-600" />
                <span>Checking midnight schedule & attendee counts...</span>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* Status Alert */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-700">Lifecycle Status:</span>
                  {postEventStatus?.lifecycleStatus === 'READY_TO_SEND' ? (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-extrabold flex items-center gap-1.5">
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                      READY TO SEND (Past Midnight)
                    </span>
                  ) : postEventStatus?.lifecycleStatus === 'SENT' ? (
                    <span className="px-2.5 py-1 bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-extrabold flex items-center gap-1.5">
                      <CheckIcon className="w-3.5 h-3.5 text-sky-600" />
                      SENT ({postEventStatus.alreadySentCount} queued)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-extrabold flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-amber-700" />
                      NOT READY (Available next day 00:00 IST)
                    </span>
                  )}
                </div>

                {/* Attendee Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Present Gate</span>
                    <span className="text-base font-black text-slate-900">{postEventStatus?.presentCount ?? 0}</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] text-emerald-700 font-bold block uppercase">Eligible WhatsApp</span>
                    <span className="text-base font-black text-emerald-700">{postEventStatus?.eligibleWhatsappCount ?? 0}</span>
                  </div>
                  <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl">
                    <span className="text-[10px] text-sky-700 font-bold block uppercase">Already Queued</span>
                    <span className="text-base font-black text-sky-700">{postEventStatus?.alreadySentCount ?? 0}</span>
                  </div>
                </div>

                {/* Gallery URL Input */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Official Event Gallery URL:</label>
                  <input
                    type="text"
                    value={postEventGalleryUrl}
                    onChange={(e) => setPostEventGalleryUrl(e.target.value)}
                    placeholder="https://www.ekdujekeliye.in/gallery"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Button 1 opens this URL. Button 2 opens the personalized attendee feedback form.
                  </span>
                </div>

                {/* Message Template Preview */}
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider block">
                    Message Preview (edkl_post_event_memories_feedback_v1)
                  </span>
                  <p className="text-[11px] text-slate-700 italic leading-relaxed">
                    &ldquo;નમસ્તે [Jaynesh &amp; Pooja], {postEventStatus?.eventName || 'Seminar'} કાર્યક્રમમાં જોડાવા બદલ આપનો દિલથી આભાર. આશા છે કે આ સંગમ આપના દાંપત્યજીવન માટે યાદગાર બન્યો હશે...&rdquo;
                  </p>
                  <div className="flex gap-2 pt-1">
                    <span className="flex-1 text-center py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-sky-700">
                      [View Event Photos]
                    </span>
                    <span className="flex-1 text-center py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-sky-700">
                      [Give Feedback]
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowPostEventModal(false)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={sendingPostEvent || (postEventStatus?.eligibleWhatsappCount ?? 0) === 0}
                onClick={handleSendPostEvent}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <CameraIcon className="w-3.5 h-3.5" />
                <span>{sendingPostEvent ? 'Queueing...' : `Send to ${postEventStatus?.eligibleWhatsappCount ?? 0} Attended`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SPECIFIC NUMBERS BULK BROADCAST MODAL */}
      {/* ========================================================================= */}
      {showSpecificBroadcastModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-indigo-600" />
                  <span>Send Specific Numbers Broadcast</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Safely targets specific attendee phone numbers with 24-hour Meta service window protection.
                </p>
              </div>
              <button onClick={() => setShowSpecificBroadcastModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Phone Numbers Input */}
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Recipient Phone Numbers (one per line or comma-separated):
                </label>
                <textarea
                  rows={3}
                  value={rawSpecificNumbers}
                  onChange={(e) => {
                    setRawSpecificNumbers(e.target.value);
                    setSpecificPreviewData(null);
                  }}
                  placeholder={'918320594829\n9876543210\n+91 99887 76655'}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Message Mode Toggle */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 block">Message Mode:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSpecificBroadcastMode('TEMPLATE');
                      setSpecificPreviewData(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                      specificBroadcastMode === 'TEMPLATE'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs">Approved Template</span>
                    <span className="text-[10px] font-normal text-slate-500">Allowed outside 24h window</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSpecificBroadcastMode('FREE_TEXT');
                      setSpecificPreviewData(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                      specificBroadcastMode === 'FREE_TEXT'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs">Free Text Message</span>
                    <span className="text-[10px] font-normal text-slate-500">Only 24h window-open</span>
                  </button>
                </div>
              </div>

              {/* Template Select or Free Text Input */}
              {specificBroadcastMode === 'TEMPLATE' ? (
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Select Meta Template:</label>
                  <LuxurySelect
                    value={specificBroadcastTemplate}
                    onChange={(val) => {
                      setSpecificBroadcastTemplate(val);
                      setSpecificPreviewData(null);
                    }}
                    options={metaTemplates.map(t => ({
                      value: t.key,
                      label: t.metaName,
                      badge: t.category,
                      sublabel: t.purpose || t.trigger
                    }))}
                    placeholder="Select approved template..."
                    searchable
                    variant="card"
                    size="sm"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                    <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>Free-text messages are strictly delivered to recipients whose 24-hour customer service window is open. Closed-window numbers will be skipped.</span>
                  </div>
                  <textarea
                    rows={2}
                    value={specificBroadcastMessage}
                    onChange={(e) => setSpecificBroadcastMessage(e.target.value)}
                    placeholder="Type custom text message to send..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              )}

              {/* Preview Audience Button & Stats */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handlePreviewSpecific}
                  disabled={loadingSpecificPreview || !rawSpecificNumbers.trim()}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <EyeIcon className={`w-3.5 h-3.5 ${loadingSpecificPreview ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>{loadingSpecificPreview ? 'Checking 24h Window Status...' : 'Preview Audience & 24h Window Status'}</span>
                </button>
              </div>

              {specificPreviewData && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Audience Breakdown</span>
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block font-bold">Input</span>
                      <span className="text-xs font-black text-slate-900">{specificPreviewData.inputCount}</span>
                    </div>
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block font-bold">Matched</span>
                      <span className="text-xs font-black text-indigo-700">{specificPreviewData.matchedCount}</span>
                    </div>
                    <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-emerald-700 block font-bold">Window Open</span>
                      <span className="text-xs font-black text-emerald-700">{specificPreviewData.windowOpenCount}</span>
                    </div>
                    <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="text-amber-800 block font-bold">Closed</span>
                      <span className="text-xs font-black text-amber-800">{specificPreviewData.windowClosedCount}</span>
                    </div>
                  </div>
                  <div className="text-center pt-1 border-t border-slate-200/60 font-bold text-xs">
                    Final Eligible Recipients: <span className="text-indigo-700 font-extrabold">{specificPreviewData.eligibleCount}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowSpecificBroadcastModal(false)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={sendingSpecificBroadcast || !specificPreviewData || specificPreviewData.eligibleCount === 0}
                onClick={handleSendSpecific}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>{sendingSpecificBroadcast ? 'Dispatching...' : `Send to ${specificPreviewData?.eligibleCount ?? 0} Recipients`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
