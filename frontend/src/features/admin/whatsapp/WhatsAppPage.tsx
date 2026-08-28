'use client';

import React, { useState, useEffect, useRef } from 'react';
import { whatsappApi, WhatsappLogItem } from '../../../services/admin/whatsappApi';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { MetaTemplate } from '../../../types/whatsapp';
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
  RefreshCwIcon
} from '../../../components/Icons';
import { LuxurySelect } from '../../../components/LuxurySelect';

export const WhatsAppPage = () => {
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [logs, setLogs] = useState<WhatsappLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Dispatch mode: 'real_couple' or 'custom_test'
  const [dispatchMode, setDispatchMode] = useState<'real_couple' | 'custom_test'>('real_couple');

  // Searchable Couple Dropdown State
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const [coupleSearchQuery, setCoupleSearchQuery] = useState('');
  const [isCoupleDropdownOpen, setIsCoupleDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Custom test inputs
  const [customPhone, setCustomPhone] = useState('918320594829');
  const [customName, setCustomName] = useState('Jaynesh & Partner');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('edkl_payment_confirmed_pass_v1');

  // Status & sending state
  const [sendingMessage, setSendingMessage] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [tplRes, subRes, logRes] = await Promise.allSettled([
        whatsappApi.getMetaTemplates(),
        registrationsApi.getSubmissions({ limit: 300 }),
        whatsappApi.getLogs(30)
      ]);

      if (tplRes.status === 'fulfilled' && tplRes.value?.metaTemplates) {
        setMetaTemplates(tplRes.value.metaTemplates);
      }
      if (subRes.status === 'fulfilled' && subRes.value?.submissions) {
        const list = subRes.value.submissions;
        setSubmissions(list);
        if (list.length > 0) {
          setSelectedSubmissionId(list[0]._id || list[0].inquiryId || '');
        }
      }
      if (logRes.status === 'fulfilled' && logRes.value?.logs) {
        setLogs(logRes.value.logs);
      }
    } catch (err) {
      console.error('Failed to load WhatsApp data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await whatsappApi.getLogs(30);
      if (res && res.logs) {
        setLogs(res.logs);
      }
    } catch (err) {
      console.error('Failed to refresh logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Close couple dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCoupleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isCoupleDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isCoupleDropdownOpen]);

  const selectedSubmission = submissions.find(
    (s) => s._id === selectedSubmissionId || s.inquiryId === selectedSubmissionId
  );

  const filteredSubmissions = submissions.filter((s) => {
    const q = coupleSearchQuery.toLowerCase();
    return (
      s.inquiryId?.toLowerCase().includes(q) ||
      s.husbandName?.toLowerCase().includes(q) ||
      s.wifeName?.toLowerCase().includes(q) ||
      s.surname?.toLowerCase().includes(q) ||
      s.phoneNumber?.includes(q)
    );
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchResult(null);

    let phoneToSend = '';
    let subId: string | undefined = undefined;
    let customVars: Record<string, string> | undefined = undefined;

    if (dispatchMode === 'real_couple') {
      if (!selectedSubmission) {
        alert('Please select a registered couple from the list.');
        return;
      }
      phoneToSend = selectedSubmission.phoneNumber;
      subId = selectedSubmission._id || selectedSubmission.inquiryId;
    } else {
      if (!customPhone) {
        alert('Please enter a recipient phone number with country code (e.g. 918320594829).');
        return;
      }
      phoneToSend = customPhone;
      customVars = {
        customerName: customName || 'Guest Couple',
        eventName: 'Ek Duje Ke Liye Seminar',
        registrationId: 'TEST-01',
        eventDate: '15 September 2026',
        eventTime: '8:30 PM',
        venue: 'Sardar Smruti Bhavan, Surat',
        feeAmount: '₹1500',
        inquiryId: 'TEST-01'
      };
    }

    try {
      setSendingMessage(true);
      const res = await whatsappApi.sendTestMessage(
        phoneToSend,
        selectedTemplateKey,
        subId,
        customVars
      );
      setDispatchResult({
        success: true,
        message: res.message || `WhatsApp message successfully dispatched to ${phoneToSend}!`
      });
      fetchLogs();
    } catch (err: any) {
      setDispatchResult({
        success: false,
        message: err?.message || 'Failed to dispatch WhatsApp message. Please check number or connection.'
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleQuickTemplateSelect = (tplKey: string) => {
    setSelectedTemplateKey(tplKey);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 w-full min-w-0">

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <MessageCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>WhatsApp Cloud API — Official Meta Templates</span>
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Meta Approved
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1 font-medium leading-relaxed">
            Direct integration with Meta WhatsApp Cloud API (v26.0). Automatic zero-spam transactional messaging for passes, payment confirmations, and reminders.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Refresh WhatsApp Activity Logs"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* Interactive WhatsApp Dispatch & Resend Console */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <WhatsappIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                WhatsApp Dispatch &amp; Pass Resend Console
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Send real official WhatsApp passes or test templates with custom variables.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setDispatchMode('real_couple')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                dispatchMode === 'real_couple'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Real Couple Mode
            </button>
            <button
              type="button"
              onClick={() => setDispatchMode('custom_test')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                dispatchMode === 'custom_test'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Custom Test Mode
            </button>
          </div>
        </div>

        <form onSubmit={handleSendMessage} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">

            {/* Official Meta Template Selector with LuxurySelect */}
            <div className="sm:col-span-6">
              <LuxurySelect
                label="Select Official Meta Template"
                value={selectedTemplateKey}
                onChange={(val) => setSelectedTemplateKey(val)}
                options={metaTemplates.map((t) => ({
                  value: t.key,
                  label: t.metaName,
                  sublabel: t.purpose || t.trigger,
                  badge: t.category
                }))}
              />
            </div>

            {/* Real Couple Searchable Dropdown OR Custom Phone Inputs */}
            {dispatchMode === 'real_couple' ? (
              <div className="sm:col-span-6 relative" ref={dropdownRef}>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Select Registered Couple Record</span>
                  <span className="text-[10px] text-emerald-700 font-bold font-mono">
                    {filteredSubmissions.length} Available
                  </span>
                </label>

                {/* Active Selection Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsCoupleDropdownOpen((prev) => !prev)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 flex items-center justify-between gap-2 text-left cursor-pointer transition-all shadow-xs"
                >
                  {selectedSubmission ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-mono font-extrabold text-[10px] rounded-md shrink-0">
                        {selectedSubmission.inquiryId}
                      </span>
                      <span className="font-extrabold text-slate-900 truncate">
                        {selectedSubmission.husbandName} &amp; {selectedSubmission.wifeName} {selectedSubmission.surname}
                      </span>
                      <span className="text-slate-400 hidden sm:inline">&bull;</span>
                      <span className="text-slate-500 font-mono text-[11px] hidden sm:inline shrink-0">
                        {selectedSubmission.phoneNumber}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">Search &amp; select couple record...</span>
                  )}
                  <svg
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isCoupleDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Panel with Search Bar */}
                {isCoupleDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95">
                    {/* Integrated Search Input Bar */}
                    <div className="relative">
                      <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={coupleSearchQuery}
                        onChange={(e) => setCoupleSearchQuery(e.target.value)}
                        placeholder="Search by couple name, phone, or Token ID..."
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      {coupleSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCoupleSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Scrollable Couple Options */}
                    <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-100">
                      {filteredSubmissions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 font-medium">
                          No registered couple found matching &ldquo;{coupleSearchQuery}&rdquo;.
                        </div>
                      ) : (
                        filteredSubmissions.map((s) => {
                          const isSelected = (s._id || s.inquiryId) === selectedSubmissionId;
                          const isVip = s.inquiryId?.startsWith('IP') || Boolean((s as any).isVip);

                          return (
                            <button
                              key={s._id || s.inquiryId}
                              type="button"
                              onClick={() => {
                                setSelectedSubmissionId(s._id || s.inquiryId || '');
                                setIsCoupleDropdownOpen(false);
                                setCoupleSearchQuery('');
                              }}
                              className={`w-full p-2 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400'
                                  : 'hover:bg-slate-50 text-slate-800'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 font-mono font-extrabold text-[10px] rounded-md ${
                                      isVip
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : 'bg-rose-100 text-rose-900'
                                    }`}
                                  >
                                    {s.inquiryId}
                                  </span>
                                  <span className="font-bold text-xs text-slate-900">
                                    {s.husbandName} &amp; {s.wifeName} {s.surname}
                                  </span>
                                  {isVip && (
                                    <span className="text-[9px] px-1 bg-amber-50 text-amber-800 border border-amber-200 rounded font-extrabold uppercase">
                                      VIP
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                                  <span className="font-mono font-bold text-slate-700">{s.phoneNumber}</span>
                                  <span>&bull;</span>
                                  <span className="truncate">{s.programName || 'Seminar Slot'}</span>
                                </div>
                              </div>

                              {isSelected && <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                    Custom Recipient Phone (with Country Code)
                  </label>
                  <input
                    type="tel"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="e.g. 918320594829"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                    Couple Display Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Jaynesh & Partner"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* Real Couple Preview Ribbon */}
          {dispatchMode === 'real_couple' && selectedSubmission && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-extrabold text-slate-900">
                  {selectedSubmission.husbandName} &amp; {selectedSubmission.wifeName} {selectedSubmission.surname}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="font-mono text-slate-600 font-bold">{selectedSubmission.phoneNumber}</span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-rose-700 font-extrabold font-mono">ID: {selectedSubmission.inquiryId}</span>
              </div>
              <span className="px-2.5 py-0.5 bg-slate-200 text-slate-800 text-[10px] font-bold rounded-md">
                Slot: {selectedSubmission.programName || 'Main Seminar'} ({selectedSubmission.programDate || 'Sept 2026'})
              </span>
            </div>
          )}

          {/* Action Button & Status Message */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500 font-medium">
              {dispatchMode === 'real_couple'
                ? '⚡ Will deliver real digital pass link & event coordinates directly to the couple.'
                : '🛡️ Test dispatch mode: Sends formatted test template with sample payload.'}
            </div>

            <button
              type="submit"
              disabled={sendingMessage}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {sendingMessage ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Dispatching to WhatsApp...</span>
                </>
              ) : (
                <>
                  <WhatsappIcon className="w-4 h-4 text-white flex-shrink-0" />
                  <span>
                    {dispatchMode === 'real_couple' ? 'Send Real WhatsApp Message' : 'Send Test WhatsApp Message'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Dispatch Result Banner */}
        {dispatchResult && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold border flex items-start gap-2.5 animate-in fade-in-50 ${
              dispatchResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            {dispatchResult.success ? (
              <CheckIcon className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangleIcon className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <span>{dispatchResult.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Official Meta Template Visualizer & Architecture Flow */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-rose-700" />
              <span>Official Meta WhatsApp Templates &amp; Lifecycle Triggers</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Every message has a dedicated lifecycle trigger to guarantee exactly 1 message per event (Zero Spam Policy).
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {metaTemplates.length} Approved Templates
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium bg-white rounded-2xl border border-slate-200">
            Loading Meta WhatsApp templates...
          </div>
        ) : metaTemplates.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
            No Meta templates found.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {metaTemplates.map((t) => (
              <div
                key={t.key}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs hover:border-emerald-400 transition-all"
              >
                <div className="space-y-3">
                  {/* Template Title & Badge */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm font-mono tracking-tight">
                      {t.metaName}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold rounded-md border border-emerald-200 uppercase">
                      Approved
                    </span>
                  </div>

                  {/* Trigger & Purpose in English & Gujarati */}
                  <div className="text-[11px] text-slate-600 font-medium space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p><strong className="text-slate-800">⚡ Trigger (ક્યારે મોકલાય?):</strong> {t.trigger || 'Lifecycle Event'}</p>
                    <p><strong className="text-slate-800">🎯 Purpose (હેતુ):</strong> {t.purpose}</p>
                  </div>

                  {/* WhatsApp Chat Bubble Mockup */}
                  <div className="bg-[#EFEAE2] border border-[#DDD6C8] rounded-xl p-3 text-xs text-slate-900 whitespace-pre-wrap font-sans leading-relaxed shadow-inner">
                    <div className="bg-white rounded-lg p-3 shadow-xs border border-slate-200/80">
                      {t.bodyText}
                    </div>
                  </div>

                  {/* Interactive Button Preview */}
                  {t.buttons && t.buttons.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Interactive Action Button:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {t.buttons.map((btn, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-extrabold shadow-2xs"
                          >
                            <span>🔗 {btn.text}</span>
                            {btn.url && <span className="text-[10px] text-emerald-700 font-mono">({btn.url})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold font-mono">
                    {t.category} &bull; {t.language}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickTemplateSelect(t.key)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Select Template ↑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent WhatsApp Dispatch Logs Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-slate-700" />
              <span>Recent WhatsApp Activity Logs</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Live status and delivery tracking from Meta Cloud API webhooks.
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Showing last {logs.length} dispatches
          </span>
        </div>

        {loadingLogs ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Loading recent logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No recent WhatsApp dispatch logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Recipient Phone</th>
                  <th className="py-2.5 px-3">Pass ID</th>
                  <th className="py-2.5 px-3">Template Name</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Meta Message ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-500">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {log.recipientPhone}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-extrabold text-rose-700">
                      {log.inquiryId || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                      {log.templateName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          log.status === 'READ'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : log.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : log.status === 'SENT'
                            ? 'bg-slate-100 text-slate-800 border border-slate-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 truncate max-w-[140px]" title={log.providerMessageId}>
                      {log.providerMessageId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Policy & Single Message Guarantee Ribbon */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs text-stone-700 space-y-2">
        <h4 className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
          <TicketIcon className="w-4 h-4 text-rose-700" />
          <span>Customer Messaging Policy &amp; Single-Message Guarantee:</span>
        </h4>
        <ul className="list-disc pl-5 space-y-1 text-stone-600">
          <li><strong>Registration Submitted:</strong> Couple receives <strong>1 single WhatsApp message</strong> (bilingual Gujarati + English with <code className="bg-white px-1.5 py-0.5 rounded border">[ Complete Payment ]</code> link).</li>
          <li><strong>Payment Captured:</strong> Couple receives <strong>1 single WhatsApp confirmation</strong> with the direct <code className="bg-white px-1.5 py-0.5 rounded border">[ View Digital Pass ]</code> button.</li>
          <li><strong>Zero Duplicate Dispatches:</strong> All repetitive automatic test messages are silenced. Real messages only trigger on genuine user actions.</li>
        </ul>
      </div>

    </div>
  );
};
