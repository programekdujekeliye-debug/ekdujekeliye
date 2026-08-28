'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { RegistrationsPage } from '../registrations/RegistrationsPage';

export const DashboardPage = () => {
  const { selectedProgramId, programs } = useAdmin();
  const [totalInquiries, setTotalInquiries] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [latestTokenId, setLatestTokenId] = useState<string>('N/A');

  const fetchStats = async () => {
    try {
      const [allSubs, appSubs, pendSubs] = await Promise.all([
        registrationsApi.getSubmissions({ page: 1, limit: 1, programId: selectedProgramId }).catch(() => null),
        registrationsApi.getSubmissions({ page: 1, limit: 1, status: 'approved', programId: selectedProgramId }).catch(() => null),
        registrationsApi.getSubmissions({ page: 1, limit: 1, status: 'pending', programId: selectedProgramId }).catch(() => null)
      ]);

      if (allSubs) {
        setTotalInquiries(allSubs.totalSubmissions || allSubs.total || 0);
        if (allSubs.submissions && allSubs.submissions.length > 0) {
          setLatestTokenId(allSubs.submissions[0].inquiryId);
        }
      }
      if (appSubs) setApprovedCount(appSubs.totalSubmissions || appSubs.total || 0);
      if (pendSubs) setPendingCount(pendSubs.totalSubmissions || pendSubs.total || 0);
    } catch (err) {
      console.error('Failed to load operational stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedProgramId]);

  return (
    <div className="space-y-6">
      {/* Operational Metric Cards (Zero Financial/Infrastructure Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Total Inquiries</span>
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 block truncate">{totalInquiries}</span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block truncate">Total couple entries received</span>
        </div>

        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Approved Passes</span>
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-600 block truncate">{approvedCount}</span>
          <span className="text-[10px] sm:text-[11px] text-emerald-600/80 font-medium block truncate">Confirmed couple reservations</span>
        </div>

        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Pending Review</span>
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-amber-600 block truncate">{pendingCount}</span>
          <span className="text-[10px] sm:text-[11px] text-amber-600/80 font-medium block truncate">Awaiting operational verification</span>
        </div>

        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Latest Token ID</span>
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-rose-700 block truncate">{latestTokenId}</span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block truncate">Most recent registration token</span>
        </div>
      </div>

      {/* Registrations & Inquiries Table View */}
      <RegistrationsPage isEmbedded={true} />
    </div>
  );
};
