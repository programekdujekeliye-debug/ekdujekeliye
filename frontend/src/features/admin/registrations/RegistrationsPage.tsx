import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { mediaApi } from '../../../services/admin/mediaApi';
import { Submission } from '../../../types';
import { API_BASE_URL } from '../../../config';
import { DuplicateSubmissionsView } from './DuplicateSubmissionsView';
import { TrashSubmissionsView } from './TrashSubmissionsView';
import { BatchExportModal } from '../reports/BatchExportModal';
import { EditRegistrationModal } from './EditRegistrationModal';
import { LuxurySelect } from '../../../components/LuxurySelect';
import {
  SearchIcon,
  CheckCircleIcon,
  TrashIcon,
  MapPinIcon,
  PhoneIcon,
  AlertTriangleIcon,
  WhatsappIcon,
  CreditCardIcon,
  DownloadIcon,
  EditIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

export const RegistrationsPage = ({ isEmbedded = false }: { isEmbedded?: boolean }) => {
  const { selectedProgramId, programs } = useAdmin();

  const [viewMode, setViewMode] = useState<'all' | 'duplicates' | 'trash'>('all');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [entryTypeFilter, setEntryTypeFilter] = useState<'all' | 'regular' | 'vip'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);

  // Archived Original Google Drive Viewer State
  const [archivedViewer, setArchivedViewer] = useState<{
    isOpen: boolean;
    loading: boolean;
    viewerUrl: string;
    filename: string;
    registrationId: string;
    error: string | null;
  }>({
    isOpen: false,
    loading: false,
    viewerUrl: '',
    filename: '',
    registrationId: '',
    error: null
  });

  const handleOpenArchivedOriginal = async (registrationId: string) => {
    setArchivedViewer({
      isOpen: true,
      loading: true,
      viewerUrl: '',
      filename: '',
      registrationId,
      error: null
    });

    try {
      const res = await mediaApi.getViewToken(registrationId);
      if (res.viewerUrl) {
        setArchivedViewer({
          isOpen: true,
          loading: false,
          viewerUrl: res.viewerUrl,
          filename: res.filename || 'Couple Photo',
          registrationId,
          error: null
        });
      } else {
        throw new Error('Viewer URL not returned by server.');
      }
    } catch (err: any) {
      setArchivedViewer({
        isOpen: true,
        loading: false,
        viewerUrl: '',
        filename: '',
        registrationId,
        error: err.message || 'Archived original unavailable in Google Drive.'
      });
    }
  };

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetProgramId, setTargetProgramId] = useState('');

  const fetchList = async (page = 1) => {
    try {
      setLoading(true);
      const isVipParam = entryTypeFilter === 'vip' ? 'true' : entryTypeFilter === 'regular' ? 'false' : undefined;
      const res = await registrationsApi.getSubmissions({
        page,
        limit: pageSize,
        search: searchQuery,
        status: statusFilter,
        paymentStatus: paymentFilter,
        programId: selectedProgramId,
        attendance: attendanceFilter,
        ...(isVipParam !== undefined ? { isVip: isVipParam } : {})
      });

      setSubmissions(res.submissions || []);
      setTotalPages(res.totalPages || 1);
      setTotalSubmissions(res.totalSubmissions || res.total || 0);
      setCurrentPage(res.currentPage || page);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'all') {
      fetchList(1);
    }
  }, [selectedProgramId, statusFilter, paymentFilter, attendanceFilter, entryTypeFilter, viewMode, pageSize]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === 'all') {
        fetchList(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getCleanDigits = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '').slice(-10);
  };

  const getDirectWhatsAppUrl = (phone?: string) => {
    const digits = getCleanDigits(phone);
    if (!digits) return '#';
    return `https://wa.me/91${digits}`;
  };

  const formatSubmissionTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'N/A';
    }
  };

  const getWhatsAppMessageUrl = (sub: Submission) => {
    const digits = getCleanDigits(sub.phoneNumber);
    if (!digits) return '#';
    const isPaid = sub.payment?.status === 'captured' || sub.status === 'approved';
    const text = isPaid
      ? `નમસ્તે ${sub.husbandName} & ${sub.wifeName}, એક દુજે કે લિયે સેમિનાર (${sub.inquiryId}) માટે તમારું કપલ રજીસ્ટ્રેશન કન્ફર્મ થયેલ છે.\n\nતમારો ડિજિટલ એન્ટ્રી પાસ: https://www.ekdujekeliye.in/pass/${sub.inquiryId}\n\nતમારું પર્સનલાઇઝ્ડ ઇન્વિટેશન કાર્ડ: https://www.ekdujekeliye.in/invitation/${sub.inquiryId}`
      : `નમસ્તે ${sub.husbandName} & ${sub.wifeName}, એક દુજે કે લિયે સેમિનાર (${sub.inquiryId}) માટે તમારું રજીસ્ટ્રેશન પેન્ડિંગ છે. પેમેન્ટ પૂર્ણ કરવા માટે કૃપા કરીને આ લિંક પર ક્લિક કરો: https://www.ekdujekeliye.in/payment/${sub.inquiryId}`;
    return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
  };


  const copyPaymentLink = (inquiryId: string) => {
    const url = `https://www.ekdujekeliye.in/payment/${inquiryId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(inquiryId);
      toast.success(`Payment link copied for ${inquiryId}!`);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleApprove = async (inquiryId: string) => {
    try {
      await registrationsApi.approveSubmission(inquiryId);
      setSubmissions((prev) =>
        prev.map((s) => (s.inquiryId === inquiryId ? { ...s, status: 'approved' } : s))
      );
      toast.success(`Registration ${inquiryId} approved!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve submission.');
    }
  };

  const handleReject = async (inquiryId: string) => {
    const reason = prompt('Enter reason for rejection:');
    if (reason === null) return;
    try {
      await registrationsApi.rejectSubmission(inquiryId, reason);
      setSubmissions((prev) =>
        prev.map((s) => (s.inquiryId === inquiryId ? { ...s, status: 'rejected' } : s))
      );
      toast.success(`Registration ${inquiryId} marked as rejected.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject submission.');
    }
  };

  const handleAttendance = async (inquiryId: string, att: 'present' | 'absent' | 'unmarked') => {
    try {
      await registrationsApi.markAttendance(inquiryId, att);
      setSubmissions((prev) =>
        prev.map((s) => (s.inquiryId === inquiryId ? { ...s, attendance: att } : s))
      );
      toast.success(`Attendance marked as ${att.toUpperCase()} for ${inquiryId}`);
    } catch (err: any) {
      toast.error('Failed to update attendance.');
    }
  };

  const handleDelete = async (inquiryId: string) => {
    if (!confirm('Move submission to trash?')) return;
    try {
      await registrationsApi.softDelete(inquiryId);
      toast.success(`Registration ${inquiryId} moved to trash.`);
      fetchList(currentPage);
    } catch (err: any) {
      toast.error('Failed to delete submission.');
    }
  };

  const handleBulkMove = async () => {
    if (selectedIds.length === 0 || !targetProgramId) {
      toast.error('Please select registrations and a target program slot.');
      return;
    }
    if (!confirm(`Move ${selectedIds.length} registrations to selected event?`)) return;

    try {
      await registrationsApi.bulkMove(selectedIds, targetProgramId);
      toast.success(`Successfully moved ${selectedIds.length} registrations. Passes & WhatsApp invitations queued!`);
      setSelectedIds([]);
      setTargetProgramId('');
      fetchList(currentPage);
    } catch (err: any) {
      toast.error('Failed to move registrations.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top View Mode Switcher */}
      {!isEmbedded && (
        <div className="flex bg-slate-200/70 p-1.5 rounded-2xl gap-2 shadow-inner">
          <button
            onClick={() => setViewMode('all')}
            className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'all' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Registrations ({totalSubmissions})
          </button>
          <button
            onClick={() => setViewMode('duplicates')}
            className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'duplicates' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Duplicate Inquiries
          </button>
          <button
            onClick={() => setViewMode('trash')}
            className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'trash' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trash Bin
          </button>
        </div>
      )}

      {viewMode === 'duplicates' ? (
        <DuplicateSubmissionsView />
      ) : viewMode === 'trash' ? (
        <TrashSubmissionsView />
      ) : (
        <div className="space-y-4">
          {/* Filter & Search Bar with Direct Export Actions */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-3 sm:p-4 md:p-5 space-y-4 w-full min-w-0">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between w-full min-w-0">
              <div className="relative flex-1 flex items-center bg-slate-50 border border-slate-300 focus-within:bg-white focus-within:border-rose-500 rounded-xl px-3 sm:px-4 py-2.5 transition-all min-w-0">
                <SearchIcon className="w-4 h-4 text-slate-500 flex-shrink-0 mr-2 sm:mr-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by token ID, name, or phone..."
                  className="w-full min-w-0 bg-transparent border-none text-slate-900 placeholder-slate-400 focus:outline-none text-xs sm:text-sm font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold ml-2 p-1 cursor-pointer shrink-0"
                    aria-label="Clear search"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Unified Export Center Button for Registrations */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap active:scale-95"
                  title="Open Custom Dynamic Export Center"
                >
                  <DownloadIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Export Center</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdowns with LuxurySelect */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <LuxurySelect
                label="Entry Type"
                value={entryTypeFilter}
                onChange={(val) => setEntryTypeFilter(val as any)}
                options={[
                  { value: 'all', label: 'All Entries (Public + VIP)', badge: 'ALL' },
                  { value: 'regular', label: 'Public Registrations', badge: 'PUBLIC' },
                  { value: 'vip', label: 'VIP Guest Passes', badge: 'VIP' }
                ]}
              />

              <LuxurySelect
                label="Registration Status"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending', badge: 'Review' },
                  { value: 'approved', label: 'Approved', badge: 'Verified' },
                  { value: 'rejected', label: 'Rejected' }
                ]}
              />

              <LuxurySelect
                label="Payment Status"
                value={paymentFilter}
                onChange={(val) => setPaymentFilter(val)}
                options={[
                  { value: 'all', label: 'All Payments' },
                  { value: 'paid', label: 'Paid (Captured)', badge: 'PAID' },
                  { value: 'pending', label: 'Pending Payment', badge: 'DUE' },
                  { value: 'failed', label: 'Failed / Cancelled' }
                ]}
              />

              <LuxurySelect
                label="Gate Attendance"
                value={attendanceFilter}
                onChange={(val) => setAttendanceFilter(val)}
                options={[
                  { value: 'all', label: 'All Attendance' },
                  { value: 'present', label: 'Present Only', badge: 'ENTERED' },
                  { value: 'absent', label: 'Absent Only' },
                  { value: 'unmarked', label: 'Unmarked Only' }
                ]}
              />

              <LuxurySelect
                label="Page Size"
                value={pageSize}
                onChange={(val) => setPageSize(Number(val))}
                options={[
                  { value: '25', label: '25 per page' },
                  { value: '50', label: '50 per page' },
                  { value: '100', label: '100 per page' }
                ]}
              />
            </div>
          </div>

          {/* Bulk Transfer Action Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-rose-900">
                <span>{selectedIds.length} registration(s) selected</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="w-full sm:w-64 min-w-0">
                  <LuxurySelect
                    value={targetProgramId}
                    onChange={(val) => setTargetProgramId(val)}
                    placeholder="-- Target Program Slot --"
                    options={programs.map((p) => ({
                      value: p.id,
                      label: p.name,
                      sublabel: p.date
                    }))}
                  />
                </div>
                <button
                  onClick={handleBulkMove}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer whitespace-nowrap min-h-[38px]"
                >
                  Move Selected
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap min-h-[38px]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Registrations List Container */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl overflow-hidden">
            {/* Desktop Table View (lg and above) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={submissions.length > 0 && selectedIds.length === submissions.length}
                        onChange={(e) => {
                          setSelectedIds(e.target.checked ? submissions.map((s) => s.inquiryId) : []);
                        }}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                    </th>
                    <th className="px-4 py-3.5">Token ID &amp; Submitted</th>
                    <th className="px-4 py-3.5">Couple Name</th>
                    <th className="px-4 py-3.5">Phone &amp; WhatsApp</th>
                    <th className="px-4 py-3.5">Program Slot</th>
                    <th className="px-4 py-3.5">Payment</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Attendance</th>
                    <th className="px-4 py-3.5">Photos</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading && submissions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        Loading registrations...
                      </td>
                    </tr>
                  ) : submissions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        No registrations match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => {
                      const isSelected = selectedIds.includes(sub.inquiryId);
                      const isApproved = sub.status === 'approved';
                      const isRejected = sub.status === 'rejected';
                      const isPending = !isApproved && !isRejected;
                      const isVip = Boolean(sub.isVip || sub.inquiryId?.startsWith('IP-') || sub.inquiryId?.includes('-IP-') || sub.payment?.provider === 'manual_invite');
                      const isPaid = sub.payment?.status === 'captured' || sub.status === 'approved' || isVip;
                      const isPaymentFailed = sub.payment?.status === 'failed';
                      const cleanDigits = getCleanDigits(sub.phoneNumber);
                      const programObj = programs.find((p) => p.id === sub.programId || p.slug === sub.programId || p.date === sub.programDate);
                      const dynamicPrice = programObj?.price !== undefined ? programObj.price : 1500;
                      const displayAmount = sub.payment?.amount !== undefined ? sub.payment.amount : (isVip ? 0 : dynamicPrice);

                      return (
                        <tr key={sub.inquiryId} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-rose-50/40' : ''}`}>
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, sub.inquiryId]
                                    : prev.filter((id) => id !== sub.inquiryId)
                                );
                              }}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={`font-mono font-extrabold text-xs px-1.5 py-0.5 rounded ${
                                  isVip ? 'bg-amber-50 text-amber-900 border border-amber-300' : 'text-rose-700'
                                }`}>
                                  {sub.inquiryId}
                                </span>
                                {isVip && (
                                  <span className="text-[9px] font-black uppercase px-1 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded">
                                    VIP
                                  </span>
                                )}
                                {sub.previousInquiryId && (
                                  <span
                                    className="text-[9px] font-mono font-semibold px-1 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200"
                                    title={`Transferred from ${sub.previousInquiryId}`}
                                  >
                                    ex: {sub.previousInquiryId}
                                  </span>
                                )}
                              </div>
                              {sub.previousInquiryId && sub.updatedAt && sub.updatedAt !== sub.createdAt ? (
                                <div className="flex flex-col text-[10px]">
                                  <span className="text-amber-700 font-medium whitespace-nowrap" title="Transferred / Modified Time">
                                    🔄 {formatSubmissionTime(sub.updatedAt)}
                                  </span>
                                  <span className="text-slate-400 text-[9px] whitespace-nowrap" title="Original Submission Time">
                                    orig: {formatSubmissionTime(sub.createdAt)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium block whitespace-nowrap">
                                  {formatSubmissionTime(sub.createdAt)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="font-bold text-slate-900 block">
                              {sub.husbandName} &amp; {sub.wifeName}
                            </span>
                            <span className="text-[11px] text-slate-500">{sub.surname}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1 items-start">
                              <a
                                href={`tel:+91${cleanDigits}`}
                                className="font-mono font-bold text-slate-900 hover:text-rose-600 flex items-center gap-1 group transition-colors"
                                title="Click to Call Mobile Number"
                              >
                                <PhoneIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />
                                <span>{sub.phoneNumber}</span>
                              </a>
                              <div className="flex items-center gap-1">
                                <a
                                  href={getDirectWhatsAppUrl(sub.phoneNumber)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold transition-all shadow-2xs cursor-pointer hover:scale-105"
                                  title="Open WhatsApp Chat directly"
                                >
                                  <WhatsappIcon className="w-3 h-3 text-emerald-600" />
                                  <span>WhatsApp</span>
                                </a>
                                {!isPaid && (
                                  <a
                                    href={getWhatsAppMessageUrl(sub)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[9px] font-bold transition-all cursor-pointer"
                                    title="Send payment link on WhatsApp"
                                  >
                                    <span>Remind</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-slate-900 font-semibold truncate block max-w-[170px]">
                              {sub.programName || 'N/A'}
                            </span>
                            <span className="text-[10px] text-slate-400">{sub.programDate}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            {isPaid ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 border border-emerald-200 text-emerald-800 whitespace-nowrap">
                                  <CheckCircleIcon className="w-3 h-3 text-emerald-600" />
                                  PAID (₹{displayAmount})
                                </span>
                                <span className="text-[9px] text-slate-400 block font-mono">
                                  {sub.payment?.provider ? sub.payment.provider.toUpperCase() : 'CONFIRMED'}
                                  {sub.payment?.razorpayPaymentId ? ` • ${sub.payment.razorpayPaymentId.slice(-6)}` : ''}
                                </span>
                              </div>
                            ) : isPaymentFailed ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 border border-red-200 text-red-700 whitespace-nowrap">
                                  <AlertTriangleIcon className="w-3 h-3 text-red-600" />
                                  FAILED
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 border border-amber-200 text-amber-800 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  UNPAID (₹{displayAmount})
                                </span>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => copyPaymentLink(sub.inquiryId)}
                                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                                    title="Copy payment link"
                                  >
                                    {copiedId === sub.inquiryId ? '✓ Copied Link' : 'Copy Pay Link'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap ${
                                isApproved
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : isRejected
                                  ? 'bg-red-50 border-red-200 text-red-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}
                            >
                              {sub.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="w-32 min-w-0">
                              <LuxurySelect
                                size="sm"
                                variant="card"
                                value={sub.attendance || 'unmarked'}
                                onChange={(val) => handleAttendance(sub.inquiryId, val as any)}
                                options={[
                                  { value: 'unmarked', label: 'Unmarked' },
                                  { value: 'present', label: 'Present', badge: 'IN' },
                                  { value: 'absent', label: 'Absent' }
                                ]}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1.5 items-start">
                              <div className="flex items-center gap-1.5">
                                {sub.couplePhoto && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedImage(sub.photoThumbnailUrl || sub.couplePhoto)}
                                    className="w-8 h-8 rounded-md overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                                    title="View Thumbnail"
                                  >
                                    <img
                                      src={
                                        (sub.photoThumbnailUrl || sub.couplePhoto).startsWith('http') ||
                                        (sub.photoThumbnailUrl || sub.couplePhoto).startsWith('data:')
                                          ? (sub.photoThumbnailUrl || sub.couplePhoto)
                                          : `${API_BASE_URL}${sub.photoThumbnailUrl || sub.couplePhoto}`
                                      }
                                      alt="Photo"
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  </button>
                                )}
                                {sub.hasArchivedOriginal && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenArchivedOriginal(sub.inquiryId)}
                                    className="px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                    title="View Original Google Drive Photo"
                                  >
                                    <span>Drive</span>
                                    <span>↗</span>
                                  </button>
                                )}
                              </div>
                              {sub.photoStorageStatus === 'ARCHIVED' && (
                                <span className="text-[9px] font-bold text-sky-600 uppercase tracking-tight whitespace-nowrap">
                                  Archived Original
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleApprove(sub.inquiryId)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs cursor-pointer whitespace-nowrap"
                                    title="Approve & Confirm Registration"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(sub.inquiryId)}
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[11px] rounded-lg cursor-pointer whitespace-nowrap"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {isApproved && (
                                <>
                                  <a
                                    href={`/pass/${sub.inquiryId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-[11px] rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                                    title="Open Gate Entry Pass"
                                  >
                                    Pass ↗
                                  </a>
                                  <a
                                    href={`/invitation/${sub.inquiryId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                                    title="Open Personalized Invitation Card"
                                  >
                                    Card ↗
                                  </a>
                                  <a
                                    href={getWhatsAppMessageUrl(sub)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg cursor-pointer transition-colors"
                                    title="Send Pass & Card on WhatsApp"
                                  >
                                    <WhatsappIcon className="w-3.5 h-3.5 text-emerald-600" />
                                  </a>
                                </>
                              )}
                              {isRejected && (
                                <button
                                  onClick={() => handleApprove(sub.inquiryId)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 font-bold text-[11px] rounded-lg cursor-pointer whitespace-nowrap"
                                  title="Re-approve this registration"
                                >
                                  Re-Approve
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingSubmission(sub)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer transition-colors"
                                title="Edit details, change event slot, or adjust status"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(sub.inquiryId)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                                title="Move to Trash"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Card View (< lg screens) */}
            <div className="lg:hidden p-3 sm:p-4 space-y-3.5">
              {loading && submissions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs">
                  Loading registrations...
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs">
                  No registrations match the selected filters.
                </div>
              ) : (
                submissions.map((sub) => {
                  const isSelected = selectedIds.includes(sub.inquiryId);
                  const isApproved = sub.status === 'approved';
                  const isRejected = sub.status === 'rejected';
                  const isPending = !isApproved && !isRejected;
                  const isPaid = sub.payment?.status === 'captured' || sub.status === 'approved';
                  const isPaymentFailed = sub.payment?.status === 'failed';
                  const cleanDigits = getCleanDigits(sub.phoneNumber);
                  const programObj = programs.find((p) => p.id === sub.programId || p.slug === sub.programId || p.date === sub.programDate);
                  const dynamicPrice = programObj?.price !== undefined ? programObj.price : 1500;
                  const isVip = sub.inquiryId?.startsWith('IP') || Boolean((sub as any).isVip);
                  const displayAmount =
                    sub.payment?.amount !== undefined ? sub.payment.amount : isVip ? 0 : dynamicPrice;

                  return (
                    <div
                      key={sub.inquiryId}
                      className={`p-3.5 sm:p-4 bg-white border rounded-2xl transition-all space-y-3.5 ${
                        isSelected
                          ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/40'
                          : 'border-slate-200/90 shadow-xs'
                      }`}
                    >
                      {/* Row 1: Checkbox, Token ID with Copy, and Date */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedIds((prev) =>
                                e.target.checked
                                  ? [...prev, sub.inquiryId]
                                  : prev.filter((id) => id !== sub.inquiryId)
                              );
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 flex-shrink-0 cursor-pointer"
                          />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-extrabold tracking-wide ${
                                isVip
                                  ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {sub.inquiryId}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(sub.inquiryId);
                                setCopiedId(sub.inquiryId);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="text-[10px] text-slate-400 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                              title="Copy Token ID"
                            >
                              {copiedId === sub.inquiryId ? '✓' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 text-slate-400 text-[10px]">
                          {sub.previousInquiryId && sub.updatedAt && sub.updatedAt !== sub.createdAt ? (
                            <span className="font-medium text-amber-700 whitespace-nowrap" title="Transferred Time">
                              🔄 {formatSubmissionTime(sub.updatedAt)}
                            </span>
                          ) : sub.createdAt ? (
                            <span className="font-medium text-slate-500 whitespace-nowrap">
                              {formatSubmissionTime(sub.createdAt)}
                            </span>
                          ) : null}
                          <button
                            onClick={() => handleDelete(sub.inquiryId)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Move to Trash"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Status Chips & Payment Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isPaid ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                            <CheckCircleIcon className="w-3 h-3 text-emerald-600" />
                            <span>Paid (₹{displayAmount})</span>
                          </span>
                        ) : isPaymentFailed ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-50 border border-red-200 text-red-700 flex items-center gap-1">
                            <AlertTriangleIcon className="w-3 h-3 text-red-600" />
                            <span>Payment Failed</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>Unpaid (₹{displayAmount})</span>
                          </span>
                        )}

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border whitespace-nowrap ${
                            isApproved
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : isRejected
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          {sub.status || 'pending'}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border whitespace-nowrap ${
                            sub.attendance === 'present'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : sub.attendance === 'absent'
                              ? 'bg-slate-100 border-slate-300 text-slate-600'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          {sub.attendance === 'present' ? '✓ Present' : sub.attendance === 'absent' ? 'Absent' : 'Unmarked'}
                        </span>
                      </div>

                      {/* Row 3: Couple Information + Photo */}
                      <div className="flex items-start gap-3 bg-slate-50/70 border border-slate-200/70 rounded-xl p-3">
                        {/* Thumbnail / Photo */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          {sub.couplePhoto ? (
                            <button
                              type="button"
                              onClick={() => setSelectedImage(sub.photoThumbnailUrl || sub.couplePhoto)}
                              className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-white cursor-pointer shadow-xs active:scale-95 transition-transform"
                              title="Tap to enlarge photo"
                            >
                              <img
                                src={
                                  (sub.photoThumbnailUrl || sub.couplePhoto).startsWith('http') ||
                                  (sub.photoThumbnailUrl || sub.couplePhoto).startsWith('data:')
                                    ? sub.photoThumbnailUrl || sub.couplePhoto
                                    : `${API_BASE_URL}${sub.photoThumbnailUrl || sub.couplePhoto}`
                                }
                                alt="Couple"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-200/80 border border-slate-300 flex items-center justify-center text-slate-400 text-[11px] font-bold">
                              No Pic
                            </div>
                          )}

                          {sub.hasArchivedOriginal && (
                            <button
                              type="button"
                              onClick={() => handleOpenArchivedOriginal(sub.inquiryId)}
                              className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-[9px] font-bold transition-colors"
                            >
                              Drive ↗
                            </button>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="font-extrabold text-slate-900 text-sm leading-snug break-words">
                            {sub.husbandName} &amp; {sub.wifeName}
                          </h4>
                          <p className="text-xs text-slate-600 font-semibold">{sub.surname}</p>

                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 pt-0.5">
                            <MapPinIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{sub.programName || 'Seminar Slot'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Phone & WhatsApp Communication Bar */}
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`tel:+91${cleanDigits}`}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          title="Call Couple"
                        >
                          <PhoneIcon className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
                          <span className="truncate font-mono">{sub.phoneNumber}</span>
                        </a>

                        <a
                          href={getDirectWhatsAppUrl(sub.phoneNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                          title="Chat on WhatsApp"
                        >
                          <WhatsappIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />
                          <span>WhatsApp</span>
                        </a>
                      </div>

                      {/* Unpaid Payment Action Box */}
                      {!isPaid && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-amber-900">Payment Pending:</span>
                            <button
                              type="button"
                              onClick={() => copyPaymentLink(sub.inquiryId)}
                              className="font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                            >
                              {copiedId === sub.inquiryId ? '✓ Copied Link' : 'Copy Pay Link'}
                            </button>
                          </div>
                          <a
                            href={getWhatsAppMessageUrl(sub)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg text-center shadow-xs transition-colors"
                          >
                            Send Payment Link on WhatsApp →
                          </a>
                        </div>
                      )}

                      {/* Row 5: Attendance Selector & Actions Strip */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        {/* Attendance LuxurySelect Dropdown */}
                        <div className="flex-1 min-w-0">
                          <LuxurySelect
                            size="sm"
                            variant="card"
                            value={sub.attendance || 'unmarked'}
                            onChange={(val) => handleAttendance(sub.inquiryId, val as any)}
                            options={[
                              { value: 'unmarked', label: 'Unmarked Attendance' },
                              { value: 'present', label: 'Present (Checked In)', badge: 'IN' },
                              { value: 'absent', label: 'Absent' }
                            ]}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprove(sub.inquiryId)}
                                className="flex-1 sm:flex-none px-3 py-2 min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                                title="Approve & Confirm Registration"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(sub.inquiryId)}
                                className="flex-1 sm:flex-none px-3 py-2 min-h-[36px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {isApproved && (
                            <>
                              <a
                                href={`/pass/${sub.inquiryId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 min-h-[34px] bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl flex items-center gap-1 shadow-2xs"
                                title="Open Gate Entry Pass"
                              >
                                <span>Pass</span>
                                <span>↗</span>
                              </a>
                              <a
                                href={`/invitation/${sub.inquiryId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 min-h-[34px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1 shadow-2xs"
                                title="Open Personalized Invitation Card"
                              >
                                <span>Card</span>
                                <span>↗</span>
                              </a>
                              <a
                                href={getWhatsAppMessageUrl(sub)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 min-h-[34px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                                title="Send Pass & Card on WhatsApp"
                              >
                                <WhatsappIcon className="w-3.5 h-3.5 text-white" />
                                <span>Send</span>
                              </a>
                            </>
                          )}
                          {isRejected && (
                            <button
                              onClick={() => handleApprove(sub.inquiryId)}
                              className="px-2.5 py-1.5 min-h-[34px] bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap"
                            >
                              Re-Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingSubmission(sub)}
                            className="px-2.5 py-1.5 min-h-[34px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                            title="Edit details & transfer event"
                          >
                            <EditIcon className="w-3.5 h-3.5 text-slate-600" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 gap-3 text-xs text-slate-600">
              <span className="text-center sm:text-left">
                Showing {submissions.length} of {totalSubmissions} entries (Page {currentPage} of {totalPages})
              </span>
              <div className="flex gap-2 w-full sm:w-auto justify-center">
                <button
                  disabled={currentPage <= 1 || loading}
                  onClick={() => fetchList(currentPage - 1)}
                  className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => fetchList(currentPage + 1)}
                  className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <img
              src={
                selectedImage.startsWith('http') || selectedImage.startsWith('data:')
                  ? selectedImage
                  : `${API_BASE_URL}${selectedImage}`
              }
              alt="Enlarged view"
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Archived Google Drive Original Photo Modal */}
      {archivedViewer.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
                <span className="font-bold text-sm text-white">
                  Archived Original — {archivedViewer.registrationId}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  Google Drive Private Archive
                </span>
              </div>
              <button
                onClick={() => setArchivedViewer((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white px-2.5 py-1 text-sm font-bold rounded-lg hover:bg-slate-800 cursor-pointer flex items-center gap-1"
              >
                <span>Close</span>
              </button>
            </div>

            <div className="flex-1 min-h-[500px] flex items-center justify-center p-2 bg-slate-950/50">
              {archivedViewer.loading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating secure signed session token...</span>
                </div>
              ) : archivedViewer.error ? (
                <div className="text-center p-6 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 max-w-md">
                  <AlertTriangleIcon className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-rose-200 mb-1">Archived Original Unavailable</h4>
                  <p className="text-xs text-rose-400">{archivedViewer.error}</p>
                </div>
              ) : (
                <iframe
                  src={archivedViewer.viewerUrl}
                  title={`Archived Photo ${archivedViewer.registrationId}`}
                  className="w-full h-[650px] border-0 rounded-xl bg-transparent"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Data Export Center Modal */}
      <BatchExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultProgramId={selectedProgramId}
      />
      {/* Edit Registration Details Modal */}
      <EditRegistrationModal
        submission={editingSubmission}
        programs={programs}
        isOpen={!!editingSubmission}
        onClose={() => setEditingSubmission(null)}
        onSuccess={(updatedSub) => {
          setSubmissions((prev) =>
            prev.map((s) => (s.inquiryId === updatedSub.inquiryId ? updatedSub : s))
          );
        }}
      />
    </div>
  );
};
