'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { Submission } from '../../../types';
import { API_BASE_URL } from '../../../config';
import { DuplicateSubmissionsView } from './DuplicateSubmissionsView';
import { TrashSubmissionsView } from './TrashSubmissionsView';
import { SearchIcon, CheckCircleIcon } from '../../../components/Icons';

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
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs font-bold text-rose-900">
                <span>{selectedIds.length} registrations selected.</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={targetProgramId}
                  onChange={(e) => setTargetProgramId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="">-- Choose Target Program Slot --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.date})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkMove}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Move Selected
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Registrations List Table */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
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
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
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
                            <div className="flex gap-1.5">
                              {sub.couplePhoto && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedImage(sub.couplePhoto)}
                                  className="w-7 h-7 rounded-md overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                                  title="View Couple Photo"
                                >
                                  <img
                                    src={
                                      sub.couplePhoto.startsWith('http') || sub.couplePhoto.startsWith('data:')
                                        ? sub.couplePhoto
                                        : `${API_BASE_URL}${sub.couplePhoto}`
                                    }
                                    alt="Photo"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleApprove(sub.inquiryId)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(sub.inquiryId)}
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[11px] rounded-lg cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDelete(sub.inquiryId)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                title="Move to Trash"
                              >
                                🗑️
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

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 gap-3 text-xs text-slate-600">
              <span>
                Showing {submissions.length} of {totalSubmissions} entries (Page {currentPage} of {totalPages})
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage <= 1 || loading}
                  onClick={() => fetchList(currentPage - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold rounded-lg cursor-pointer transition-all"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => fetchList(currentPage + 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold rounded-lg cursor-pointer transition-all"
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
    </div>
  );
};
