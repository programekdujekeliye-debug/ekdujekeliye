import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { mediaApi } from '../../../services/admin/mediaApi';
import { Submission } from '../../../types';
import { API_BASE_URL } from '../../../config';
import { DuplicateSubmissionsView } from './DuplicateSubmissionsView';
import { TrashSubmissionsView } from './TrashSubmissionsView';
import { SearchIcon, CheckCircleIcon, TrashIcon, MapPinIcon, PhoneIcon, AlertTriangleIcon } from '../../../components/Icons';

export const RegistrationsPage = ({ isEmbedded = false }: { isEmbedded?: boolean }) => {
  const { selectedProgramId, programs } = useAdmin();

  const [viewMode, setViewMode] = useState<'all' | 'duplicates' | 'trash'>('all');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
      const res = await registrationsApi.getSubmissions({
        page,
        limit: pageSize,
        search: searchQuery,
        status: statusFilter,
        programId: selectedProgramId,
        attendance: attendanceFilter
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
  }, [selectedProgramId, statusFilter, attendanceFilter, viewMode, pageSize]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === 'all') {
        fetchList(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleApprove = async (inquiryId: string) => {
    try {
      await registrationsApi.approveSubmission(inquiryId);
      setSubmissions((prev) =>
        prev.map((s) => (s.inquiryId === inquiryId ? { ...s, status: 'approved' } : s))
      );
    } catch (err) {
      alert('Failed to approve submission.');
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
    } catch (err) {
      alert('Failed to reject submission.');
    }
  };

  const handleAttendance = async (inquiryId: string, att: 'present' | 'absent' | 'unmarked') => {
    try {
      await registrationsApi.markAttendance(inquiryId, att);
      setSubmissions((prev) =>
        prev.map((s) => (s.inquiryId === inquiryId ? { ...s, attendance: att } : s))
      );
    } catch (err) {
      alert('Failed to update attendance.');
    }
  };

  const handleDelete = async (inquiryId: string) => {
    if (!confirm('Move submission to trash?')) return;
    try {
      await registrationsApi.softDelete(inquiryId);
      fetchList(currentPage);
    } catch (err) {
      alert('Failed to delete submission.');
    }
  };

  const handleBulkMove = async () => {
    if (selectedIds.length === 0 || !targetProgramId) {
      alert('Please select registrations and a target program slot.');
      return;
    }
    if (!confirm(`Move ${selectedIds.length} registrations to selected event?`)) return;

    try {
      await registrationsApi.bulkMove(selectedIds, targetProgramId);
      setSelectedIds([]);
      setTargetProgramId('');
      fetchList(currentPage);
    } catch (err) {
      alert('Failed to move registrations.');
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
          {/* Filter & Search Bar */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 md:p-5 space-y-4">
            <div className="relative flex items-center bg-slate-50 border border-slate-300 focus-within:bg-white focus-within:border-rose-500 rounded-xl px-4 py-2.5 transition-all">
              <SearchIcon className="w-4 h-4 text-slate-500 flex-shrink-0 mr-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by token ID (e.g. EK06-01), name, surname, or phone..."
                className="w-full bg-transparent border-none text-slate-900 placeholder-slate-400 focus:outline-none text-xs sm:text-sm font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Attendance</label>
                <select
                  value={attendanceFilter}
                  onChange={(e) => setAttendanceFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Attendance</option>
                  <option value="present">Present Only</option>
                  <option value="absent">Absent Only</option>
                  <option value="unmarked">Unmarked Only</option>
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Page Size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bulk Transfer Action Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-rose-900">
                <span>{selectedIds.length} registration(s) selected</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={targetProgramId}
                  onChange={(e) => setTargetProgramId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 flex-1 sm:flex-none min-w-0"
                >
                  <option value="">-- Target Program Slot --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.date})
                    </option>
                  ))}
                </select>
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
                    <th className="px-4 py-3.5">Token ID</th>
                    <th className="px-4 py-3.5">Couple Name</th>
                    <th className="px-4 py-3.5">Phone</th>
                    <th className="px-4 py-3.5">Program Slot</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Attendance</th>
                    <th className="px-4 py-3.5">Photos</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading && submissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        Loading registrations...
                      </td>
                    </tr>
                  ) : submissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        No registrations match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => {
                      const isSelected = selectedIds.includes(sub.inquiryId);
                      const isApproved = sub.status === 'approved';
                      const isRejected = sub.status === 'rejected';
                      const isPending = !isApproved && !isRejected;

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
                          <td className="px-4 py-3.5 font-mono font-bold text-rose-700">{sub.inquiryId}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-slate-900 block">
                              {sub.husbandName} &amp; {sub.wifeName}
                            </span>
                            <span className="text-[11px] text-slate-500">{sub.surname}</span>
                          </td>
                          <td className="px-4 py-3.5 font-mono">{sub.phoneNumber}</td>
                          <td className="px-4 py-3.5">
                            <span className="text-slate-900 font-semibold truncate block max-w-[180px]">
                              {sub.programName || 'N/A'}
                            </span>
                            <span className="text-[10px] text-slate-400">{sub.programDate}</span>
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
                            <select
                              value={sub.attendance || 'unmarked'}
                              onChange={(e) => handleAttendance(sub.inquiryId, e.target.value as any)}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                            >
                              <option value="unmarked">Unmarked</option>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                            </select>
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
            <div className="lg:hidden p-3 sm:p-4 space-y-3">
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

                  return (
                    <div
                      key={sub.inquiryId}
                      className={`p-3.5 sm:p-4 bg-white border rounded-2xl transition-all space-y-3 ${
                        isSelected ? 'border-rose-400 bg-rose-50/30 ring-1 ring-rose-400' : 'border-slate-200 shadow-xs'
                      }`}
                    >
                      {/* Card Top: Checkbox, Token ID, Status */}
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
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="font-mono font-bold text-rose-700 text-xs sm:text-sm">{sub.inquiryId}</span>
                        </div>
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
                      </div>

                      {/* Card Middle: Photo + Couple Details */}
                      <div className="flex items-start gap-3">
                        {/* Thumbnail / Drive */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          {sub.couplePhoto ? (
                            <button
                              type="button"
                              onClick={() => setSelectedImage(sub.photoThumbnailUrl || sub.couplePhoto)}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-xs"
                            >
                              <img
                                src={
                                  (sub.photoThumbnailUrl || sub.couplePhoto).startsWith('http') ||
                                  (sub.photoThumbnailUrl || sub.couplePhoto).startsWith('data:')
                                    ? (sub.photoThumbnailUrl || sub.couplePhoto)
                                    : `${API_BASE_URL}${sub.photoThumbnailUrl || sub.couplePhoto}`
                                }
                                alt="Couple"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                              No Pic
                            </div>
                          )}
                          {sub.hasArchivedOriginal && (
                            <button
                              type="button"
                              onClick={() => handleOpenArchivedOriginal(sub.inquiryId)}
                              className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[9px] font-bold"
                            >
                              Drive ↗
                            </button>
                          )}
                        </div>

                        {/* Text info */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                            {sub.husbandName} &amp; {sub.wifeName}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium truncate">{sub.surname}</p>
                          <a
                            href={`tel:${sub.phoneNumber}`}
                            className="text-[11px] text-rose-600 font-mono font-bold flex items-center gap-1"
                          >
                            <PhoneIcon className="w-3 h-3 flex-shrink-0" />
                            <span>{sub.phoneNumber}</span>
                          </a>
                          <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                            <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                            <span>{sub.programName || 'N/A'} ({sub.programDate})</span>
                          </p>
                        </div>
                      </div>

                      {/* Card Bottom: Attendance & Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                        {/* Attendance Touch Target */}
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-500 flex-shrink-0">Attendance:</span>
                          <select
                            value={sub.attendance || 'unmarked'}
                            onChange={(e) => handleAttendance(sub.inquiryId, e.target.value as any)}
                            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none w-full cursor-pointer min-h-[30px]"
                          >
                            <option value="unmarked">Unmarked</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                          </select>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprove(sub.inquiryId)}
                                className="px-3 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(sub.inquiryId)}
                                className="px-3 py-1.5 min-h-[36px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <a
                            href={`/pass/${sub.inquiryId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                            title="View Pass"
                          >
                            Pass
                          </a>
                          <button
                            onClick={() => handleDelete(sub.inquiryId)}
                            className="p-2 min-h-[36px] min-w-[36px] text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 cursor-pointer flex items-center justify-center transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
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
                className="text-slate-400 hover:text-white px-2.5 py-1 text-sm font-bold rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕ Close
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
    </div>
  );
};
