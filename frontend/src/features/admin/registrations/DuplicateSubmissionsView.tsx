'use client';

import React, { useState, useEffect } from 'react';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { DuplicateGroup } from '../../../types';
import { API_BASE_URL } from '../../../config';

export const DuplicateSubmissionsView = () => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const fetchDuplicates = async () => {
    try {
      setLoading(true);
      const data = await registrationsApi.getDuplicates();
      setDuplicateGroups(data || []);
    } catch (err) {
      console.error('Failed to load duplicates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const handleBulkDelete = async () => {
    if (selectedInquiryIds.length === 0) return;
    if (!confirm(`Are you sure you want to move ${selectedInquiryIds.length} duplicate submissions to trash?`)) return;

    try {
      setDeleting(true);
      await registrationsApi.bulkDelete(selectedInquiryIds);
      setSelectedInquiryIds([]);
      fetchDuplicates();
    } catch (err) {
      alert('Failed to delete selected submissions.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-500 font-medium text-xs">Scanning for duplicate inquiries...</div>;
  }

  if (duplicateGroups.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white font-medium text-xs">
        No duplicate inquiries found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Bulk Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 shadow-xs rounded-2xl p-4">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
          <span>✅</span>
          <span>{selectedInquiryIds.length} duplicate submissions selected.</span>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {selectedInquiryIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer whitespace-nowrap"
            >
              🗑️ Delete ({selectedInquiryIds.length})
            </button>
          )}
          <button
            onClick={() => {
              const allIds = duplicateGroups.flatMap((g) => g.submissions.map((s) => s.inquiryId));
              setSelectedInquiryIds(selectedInquiryIds.length === allIds.length ? [] : allIds);
            }}
            className="flex-1 sm:flex-none px-3 py-2 min-h-[38px] border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap"
          >
            {selectedInquiryIds.length === duplicateGroups.flatMap((g) => g.submissions.map((s) => s.inquiryId)).length
              ? 'Deselect All'
              : 'Select All Duplicates'}
          </button>
        </div>
      </div>

      {duplicateGroups.map((group) => (
        <div key={group.id} className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{group.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Found {group.submissions.length} conflicting submissions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {group.submissions.map((sub) => {
              const isSelected = selectedInquiryIds.includes(sub.inquiryId);

              return (
                <div
                  key={sub.inquiryId}
                  className={`border rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all space-y-4 relative ${
                    isSelected ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="absolute top-4 right-4 z-10 flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedInquiryIds((prev) =>
                          checked ? [...prev, sub.inquiryId] : prev.filter((id) => id !== sub.inquiryId)
                        );
                      }}
                      className="w-4.5 h-4.5 text-rose-600 bg-white border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2 pr-8">
                      <div>
                        <span className="font-mono text-[10px] text-slate-500 font-bold">Token ID</span>
                        <div className="font-mono text-sm text-rose-700 font-bold">{sub.inquiryId}</div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-slate-100 border-slate-200 text-slate-700">
                        {sub.status || 'pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs border-t border-b border-slate-200 py-2.5">
                      <div>
                        <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Couple</span>
                        <span className="text-slate-900 font-bold">
                          {sub.husbandName} &amp; {sub.wifeName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Surname</span>
                        <span className="text-slate-900 font-bold">{sub.surname}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Phone</span>
                        <span className="text-slate-900 font-mono font-bold">{sub.phoneNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Slot</span>
                        <span className="text-slate-900 font-bold truncate block">{sub.programName || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
