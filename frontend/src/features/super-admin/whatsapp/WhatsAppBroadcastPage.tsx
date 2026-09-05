'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  whatsappApi,
  BroadcastCampaignOverviewResponse,
  BroadcastLogItem
} from '../../../services/admin/whatsappApi';
import {
  SendIcon,
  CheckIcon,
  CheckCheckIcon,
  RefreshCwIcon,
  SearchIcon,
  UsersIcon,
  EyeIcon,
  XIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  CalendarIcon,
  ClockIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

export const WhatsAppBroadcastPage: React.FC = () => {
  // State for overview metrics & campaigns
  const [overview, setOverview] = useState<BroadcastCampaignOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // State for recipient logs
  const [logs, setLogs] = useState<BroadcastLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(20);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [unmaskedRows, setUnmaskedRows] = useState<Record<string, boolean>>({});

  // Message Detail Modal
  const [selectedLog, setSelectedLog] = useState<BroadcastLogItem | null>(null);

  // New Campaign Modal
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('edkl_september_special_invite_v1');
  const [selectedCohort, setSelectedCohort] = useState('RICH_ROYAL_SALON');
  const [testPhoneNumber, setTestPhoneNumber] = useState('918320594829');
  const [sendingTest, setSendingTest] = useState(false);
  const [launchingCampaign, setLaunchingCampaign] = useState(false);

  // Fetch overview metrics
  const fetchOverview = useCallback(async (showToast = false) => {
    try {
      setLoadingOverview(true);
      const data = await whatsappApi.getBroadcastOverview();
      setOverview(data);
      if (showToast) {
        toast.success('Broadcast overview refreshed');
      }
    } catch (err: any) {
      console.error('Error fetching broadcast overview:', err);
      toast.error('Failed to load broadcast overview');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // Fetch paginated logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const data = await whatsappApi.getBroadcastLogs({
        page: currentPage,
        limit: pageSize,
        status: statusFilter,
        search: searchQuery
      });
      setLogs(data.logs || []);
      setTotalLogs(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Error fetching broadcast logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [currentPage, pageSize, statusFilter, searchQuery]);

  // Initial Load
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh interval (every 8 seconds when active)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOverview();
      fetchLogs();
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchOverview, fetchLogs]);

  // Handle test dispatch from modal
  const handleSendTest = async () => {
    if (!testPhoneNumber.trim()) {
      toast.error('Please enter a test phone number');
      return;
    }
    try {
      setSendingTest(true);
      const res = await whatsappApi.launchBroadcastCampaign({
        templateKey: selectedTemplate,
        audienceCohort: selectedCohort,
        testOnly: true,
        testRecipientPhone: testPhoneNumber
      });
      if (res.success) {
        toast.success(`Test message sent to ${testPhoneNumber}!`);
      } else {
        toast.error(res.message || 'Failed to send test message');
      }
    } catch (err: any) {
      toast.error(err.message || 'Test send failed');
    } finally {
      setSendingTest(false);
    }
  };

  // Handle launch broadcast
  const handleLaunchBroadcast = async () => {
    const confirmLaunch = window.confirm(
      'Are you sure you want to launch this marketing broadcast to the target cohort? This will send live WhatsApp messages to all verified contacts in this cohort.'
    );
    if (!confirmLaunch) return;

    try {
      setLaunchingCampaign(true);
      const res = await whatsappApi.launchBroadcastCampaign({
        templateKey: selectedTemplate,
        audienceCohort: selectedCohort,
        testOnly: false
      });
      if (res.success) {
        toast.success(res.message);
        setShowLaunchModal(false);
        fetchOverview(true);
        fetchLogs();
      } else {
        toast.error(res.message || 'Failed to launch broadcast');
      }
    } catch (err: any) {
      toast.error(err.message || 'Broadcast launch failed');
    } finally {
      setLaunchingCampaign(false);
    }
  };

  // Toggle masking for a phone number
  const togglePhoneMask = (id: string) => {
    setUnmaskedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
              Super Admin Only
            </span>
            <span className="text-xs font-semibold text-stone-500">Official WhatsApp Center</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight">
            Broadcast &amp; Marketing Campaigns
          </h1>
          <p className="text-xs md:text-sm text-stone-600 mt-1">
            Real-time delivery analytics, recipient inspection, and safe campaign broadcast control.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOverview(true)}
            disabled={loadingOverview}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowLaunchModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
          >
            <SendIcon className="w-3.5 h-3.5" />
            <span>+ New Campaign</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Campaigns */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Campaigns</span>
            <span className="p-1.5 rounded-lg bg-stone-100 text-stone-600">
              <CalendarIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-stone-900 mt-2">
            {overview?.summary?.totalCampaigns ?? 0}
          </div>
          <span className="text-[11px] text-stone-500 font-medium mt-1 block">Active / Past Batches</span>
        </div>

        {/* Total Messages Dispatched */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Dispatched</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
              <SendIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-stone-900 mt-2">
            {overview?.summary?.totalBroadcastMessages ?? 0}
          </div>
          <span className="text-[11px] text-amber-700 font-medium mt-1 block">
            {overview?.summary?.sending ? `${overview.summary.sending} in flight` : 'All processed'}
          </span>
        </div>

        {/* Delivery Rate */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Delivered Rate</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
              <CheckIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">
            {overview?.summary?.deliveredRate ?? 100}%
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            Accepted by Meta Cloud API
          </span>
        </div>

        {/* Read Rate */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Read / Opened</span>
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-200/60">
              <CheckCheckIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-sky-700 mt-2">
            {overview?.summary?.read ?? 0}
          </div>
          <span className="text-[11px] text-sky-600 font-medium mt-1 block">
            Confirmed Blue Ticks
          </span>
        </div>

        {/* Failed Count */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Failed</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60">
              <AlertTriangleIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-rose-700 mt-2">
            {overview?.summary?.failed ?? 0}
          </div>
          <span className="text-[11px] text-rose-600 font-medium mt-1 block">
            Blocked or invalid phones
          </span>
        </div>
      </div>

      {/* Active & Recent Campaigns Section */}
      <div className="bg-white border border-stone-200/90 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Broadcast Campaigns List</h2>
            <p className="text-xs text-stone-500">Active and completed marketing campaigns with live status.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-stone-600 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 border-stone-300"
              />
              <span>Live Auto-Refresh (8s)</span>
            </label>
          </div>
        </div>

        {overview?.campaigns && overview.campaigns.length > 0 ? (
          <div className="space-y-4">
            {overview.campaigns.map(camp => {
              const isSending = camp.status === 'SENDING';
              return (
                <div
                  key={camp.id}
                  className="border border-stone-200 rounded-2xl p-5 bg-stone-50/50 hover:bg-stone-50 transition-all space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-stone-900">{camp.title}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isSending
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isSending ? 'Sending in Progress...' : 'Completed'}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 flex flex-wrap items-center gap-3">
                        <span><strong>Template:</strong> {camp.templateName}</span>
                        <span>•</span>
                        <span><strong>Target:</strong> {camp.audience}</span>
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <span className="text-xs font-semibold text-stone-500 block">Total Target</span>
                      <span className="text-lg font-black text-stone-900">{camp.totalRecipients} Contacts</span>
                    </div>
                  </div>

                  {/* Progress Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-200/60 text-xs">
                    <div>
                      <span className="text-stone-500 block">Sent:</span>
                      <span className="font-bold text-stone-800">{camp.sentCount}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Delivered:</span>
                      <span className="font-bold text-emerald-700">{camp.deliveredCount}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Read:</span>
                      <span className="font-bold text-sky-700">{camp.readCount}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Failed:</span>
                      <span className="font-bold text-rose-700">{camp.failedCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-stone-500 text-xs">
            No broadcast campaigns recorded yet. Click &quot;+ New Campaign&quot; to launch your first broadcast.
          </div>
        )}
      </div>

      {/* Recipient Messages Audit Log */}
      <div className="bg-white border border-stone-200/90 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Recipient Delivery Logs</h2>
            <p className="text-xs text-stone-500">Live stream of individual WhatsApp messages dispatched.</p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search phone or couple..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500"
              />
              <SearchIcon className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
            </div>

            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl font-medium text-stone-700 focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Table of Recipient Logs */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600">
            <thead className="bg-stone-50 text-[11px] uppercase font-bold text-stone-500 tracking-wider border-y border-stone-200">
              <tr>
                <th className="py-3 px-4">Recipient Couple</th>
                <th className="py-3 px-4">Mobile Number</th>
                <th className="py-3 px-4">Template</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sent Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loadingLogs ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    <RefreshCwIcon className="w-4 h-4 animate-spin mx-auto mb-1" />
                    <span>Loading delivery logs...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    No recipient logs found matching your filters.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isUnmasked = unmaskedRows[log.id];
                  const displayPhone = isUnmasked ? log.recipientPhone : log.recipientMasked;

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <ClockIcon className="w-3 h-3" />
                      <span>Sent</span>
                    </span>
                  );

                  if (log.status === 'DELIVERED') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckIcon className="w-3 h-3" />
                        <span>Delivered</span>
                      </span>
                    );
                  } else if (log.status === 'READ') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        <CheckCheckIcon className="w-3 h-3" />
                        <span>Read</span>
                      </span>
                    );
                  } else if (log.status === 'FAILED') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangleIcon className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    );
                  }

                  return (
                    <tr key={log.id} className="hover:bg-stone-50/80 transition-all">
                      <td className="py-3 px-4 font-bold text-stone-900">
                        <div>{log.customerName}</div>
                        {log.inquiryId && log.inquiryId !== '-' && (
                          <span className="text-[10px] font-mono text-stone-400">ID: {log.inquiryId}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{displayPhone}</span>
                          <button
                            onClick={() => togglePhoneMask(log.id)}
                            title="Toggle Masking"
                            className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
                          >
                            <EyeIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                          {log.templateName}
                        </span>
                      </td>
                      <td className="py-3 px-4">{statusBadge}</td>
                      <td className="py-3 px-4 text-stone-500 text-[11px]">
                        {new Date(log.sentAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 text-[11px] font-bold text-stone-600 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg shadow-sm cursor-pointer"
                        >
                          View Copy
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
          <div>
            Showing {logs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} messages
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loadingLogs}
              className="px-3 py-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40 font-semibold cursor-pointer"
            >
              Previous
            </button>
            <span className="font-bold text-stone-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loadingLogs}
              className="px-3 py-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40 font-semibold cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Message Copy Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-extrabold text-stone-900 text-sm">Dispatched WhatsApp Message</h3>
                <p className="text-[11px] text-stone-500 font-mono">
                  Recipient: {selectedLog.customerName} ({selectedLog.recipientPhone})
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer rounded-lg"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Smartphone WhatsApp Bubble Preview */}
            <div className="bg-[#E5DDD5] p-4 rounded-2xl border border-stone-300 max-h-96 overflow-y-auto">
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3 text-xs text-stone-900 whitespace-pre-wrap leading-relaxed">
                {selectedLog.content}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-center">
                  <span className="text-rose-600 font-bold flex items-center gap-1.5 text-xs">
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    Visit Website (https://www.ekdujekeliye.in/)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-stone-400 font-mono">
              Meta Provider ID: {selectedLog.providerMessageId}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Campaign Launch Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Campaign Launcher
                </span>
                <h3 className="text-lg font-extrabold text-stone-900 mt-1">Start New Marketing Broadcast</h3>
              </div>
              <button
                onClick={() => setShowLaunchModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer rounded-lg"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Template Selection */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">WhatsApp Template</label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-medium text-stone-800 focus:outline-none focus:border-rose-500"
                >
                  <option value="edkl_september_special_invite_v1">
                    edkl_september_special_invite_v1 (દોડધામ ભરેલી જિંદગીમાં... - Manish Vaghasiya - MARKETING)
                  </option>
                  <option value="edkl_all_couples_invite_v1">
                    edkl_all_couples_invite_v1 (All Couples - Married, Engaged &amp; Committed - MARKETING)
                  </option>
                  <option value="edkl_september_gift_share_v3">
                    edkl_september_gift_share_v3 (Gift &amp; Share Couple Seminar - MARKETING)
                  </option>
                </select>
              </div>

              {/* Target Audience Cohort */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">Audience Cohort</label>
                <select
                  value={selectedCohort}
                  onChange={e => setSelectedCohort(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-medium text-stone-800 focus:outline-none focus:border-rose-500"
                >
                  <option value="RICH_ROYAL_SALON">
                    RICH &amp; ROYAL Salon Contacts (6,133 Surat Numbers - Deduplicated)
                  </option>
                  <option value="TBD_AND_PAST_PENDING">
                    TBD &amp; Past Unpaid Registrations (Safe - Strictly Excludes Upcoming EK06, EK07, EK08)
                  </option>
                </select>
              </div>

              {/* Safety Alert */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Gate Active:</strong> Upcoming active seminars (07-Sep, 11-Sep, 19-Sep) are automatically excluded. Duplicate protection and rate-limiting are strictly enforced.
                </span>
              </div>

              {/* Test Message Section */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                <label className="block text-stone-700 font-bold">1. Send Test Preview to Your WhatsApp</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testPhoneNumber}
                    onChange={e => setTestPhoneNumber(e.target.value)}
                    placeholder="918320594829"
                    className="flex-1 p-2 bg-white border border-stone-200 rounded-xl font-mono text-xs focus:outline-none focus:border-rose-500"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest}
                    className="px-3.5 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50 text-xs"
                  >
                    {sendingTest ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
              <button
                onClick={() => setShowLaunchModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunchBroadcast}
                disabled={launchingCampaign}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {launchingCampaign ? 'Launching Broadcast...' : 'Launch Broadcast Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
