'use client';

import React, { useState, useEffect } from 'react';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { Submission } from '../../../types';
import toast from 'react-hot-toast';

export const TrashSubmissionsView = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);

  const fetchTrash = async (p = 1) => {
    try {
      setLoading(true);
      const res = await registrationsApi.getTrash(p, 10);
      setSubmissions(res.submissions || []);
      setTotalPages(res.totalPages || 1);
      setTotalSubmissions(res.totalSubmissions || 0);
      setPage(res.currentPage || p);
    } catch (err) {
      console.error('Failed to load trash:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash(1);
  }, []);

  const handleRestore = async (inquiryId: string) => {
    try {
      await registrationsApi.restoreSubmission(inquiryId);
      toast.success(`Registration ${inquiryId} restored!`);
      fetchTrash(page);
    } catch (err: any) {
      toast.error('Failed to restore submission.');
    }
  };

  const handlePermanentDelete = async (inquiryId: string) => {
    if (!confirm('Are you sure you want to permanently delete this submission? This cannot be undone.')) return;
    try {
      await registrationsApi.permanentDelete(inquiryId);
      toast.success(`Registration ${inquiryId} permanently deleted.`);
      fetchTrash(page);
    } catch (err: any) {
      toast.error('Failed to delete permanently.');
    }
  };

  if (loading && submissions.length === 0) {
    return <div className="text-center py-20 text-slate-500 font-medium text-xs">Loading trash bin...</div>;
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white font-medium text-xs">
        Trash bin is empty.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 sm:p-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Trash Bin ({totalSubmissions} items)</h3>
        </div>

        <div className="divide-y divide-slate-100">
          {submissions.map((sub) => (
            <div key={sub.inquiryId} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs font-bold text-rose-700">{sub.inquiryId}</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                  {sub.husbandName} &amp; {sub.wifeName} {sub.surname}
                </p>
                <span className="text-[11px] text-slate-500 font-mono">{sub.phoneNumber}</span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto">
                <button
                  onClick={() => handleRestore(sub.inquiryId)}
                  className="flex-1 sm:flex-none px-3 py-2 min-h-[38px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-200 cursor-pointer text-center"
                >
                  Restore
                </button>
                <button
                  onClick={() => handlePermanentDelete(sub.inquiryId)}
                  className="flex-1 sm:flex-none px-3 py-2 min-h-[38px] bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all border border-red-200 cursor-pointer text-center"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4 text-xs font-medium text-slate-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchTrash(page - 1)}
                className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl font-bold cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchTrash(page + 1)}
                className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl font-bold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
