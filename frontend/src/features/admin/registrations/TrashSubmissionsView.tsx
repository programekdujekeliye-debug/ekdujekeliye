'use client';

import React, { useState, useEffect } from 'react';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { Submission } from '../../../types';

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
      fetchTrash(page);
    } catch (err) {
      alert('Failed to restore submission.');
    }
  };

  const handlePermanentDelete = async (inquiryId: string) => {
    if (!confirm('Are you sure you want to permanently delete this submission? This cannot be undone.')) return;
    try {
      await registrationsApi.permanentDelete(inquiryId);
      fetchTrash(page);
    } catch (err) {
      alert('Failed to delete permanently.');
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
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
          <h3 className="font-extrabold text-slate-900 text-base">Trash Bin ({totalSubmissions} items)</h3>
        </div>

        <div className="divide-y divide-slate-100">
          {submissions.map((sub) => (
            <div key={sub.inquiryId} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-rose-700">{sub.inquiryId}</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  {sub.husbandName} &amp; {sub.wifeName} {sub.surname}
                </p>
                <span className="text-[11px] text-slate-500 font-mono">{sub.phoneNumber}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(sub.inquiryId)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-all border border-emerald-200 cursor-pointer"
                >
                  Restore
                </button>
                <button
                  onClick={() => handlePermanentDelete(sub.inquiryId)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-all border border-red-200 cursor-pointer"
                >
                  Delete Permanently
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
                className="px-3 py-1.5 bg-slate-100 disabled:opacity-50 rounded-lg font-bold"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchTrash(page + 1)}
                className="px-3 py-1.5 bg-slate-100 disabled:opacity-50 rounded-lg font-bold"
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
