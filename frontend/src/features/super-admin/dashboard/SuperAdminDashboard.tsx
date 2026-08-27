'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../admin/context/AdminContext';
import { settingsApi } from '../../../services/admin/settingsApi';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { resourcesApi } from '../../../services/admin/resourcesApi';
import { DatabaseStats } from '../../../types';
import { RegistrationsPage } from '../../admin/registrations/RegistrationsPage';

export const SuperAdminDashboard = () => {
  const { selectedProgramId } = useAdmin();
  const [totalInquiries, setTotalInquiries] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [latestTokenId, setLatestTokenId] = useState<string>('N/A');
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [resources, setResources] = useState<any | null>(null);

  const fetchCommandStats = async () => {
    try {
      const [allSubs, appSubs, pendSubs, db, res] = await Promise.all([
        registrationsApi.getSubmissions({ page: 1, limit: 1, programId: selectedProgramId }).catch(() => null),
        registrationsApi.getSubmissions({ page: 1, limit: 1, status: 'approved', programId: selectedProgramId }).catch(() => null),
        registrationsApi.getSubmissions({ page: 1, limit: 1, status: 'pending', programId: selectedProgramId }).catch(() => null),
        settingsApi.getDbStatus().catch(() => null),
        resourcesApi.getSystemResources().catch(() => null)
      ]);

      if (allSubs) {
        setTotalInquiries(allSubs.totalSubmissions || allSubs.total || 0);
        if (allSubs.submissions && allSubs.submissions.length > 0) {
          setLatestTokenId(allSubs.submissions[0].inquiryId);
        }
      }
      if (appSubs) setApprovedCount(appSubs.totalSubmissions || appSubs.total || 0);
      if (pendSubs) setPendingCount(pendSubs.totalSubmissions || pendSubs.total || 0);
      if (db) setDbStats(db);
      if (res) setResources(res);
    } catch (err) {
      console.error('Failed to load Super Admin command metrics:', err);
    }
  };

  useEffect(() => {
    fetchCommandStats();
  }, [selectedProgramId]);

  return (
    <div className="space-y-8">
      {/* Top Command Metric Cards (Operational & Infrastructure - Financial details moved exclusively to Finance section) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Inquiries */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Total Inquiries</span>
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 block">{totalInquiries}</span>
          <span className="text-[11px] text-slate-400 font-medium block">Latest Token: {latestTokenId}</span>
        </div>

        {/* Approved Passes */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Approved Registrations</span>
          <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600 block">{approvedCount}</span>
          <span className="text-[11px] text-emerald-600/80 font-medium block">Confirmed couple slots</span>
        </div>

        {/* Pending Review */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Pending Review</span>
          <span className="text-3xl sm:text-4xl font-extrabold text-amber-600 block">{pendingCount}</span>
          <span className="text-[11px] text-amber-600/80 font-medium block">Awaiting verification</span>
        </div>

        {/* MongoDB Database Storage & System Health */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Database &amp; System</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {dbStats ? `${dbStats.storageSizeMB.toFixed(1)} MB / ${dbStats.totalLimitMB} MB` : 'Loading...'}
          </span>
          {dbStats && (
            <div className="mt-2 space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${
                    dbStats.storageSizeMB / dbStats.totalLimitMB > 0.8 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (dbStats.storageSizeMB / dbStats.totalLimitMB) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">
                {((dbStats.storageSizeMB / dbStats.totalLimitMB) * 100).toFixed(1)}% used &bull; Render RSS: {resources?.memory?.rssMB ? `${resources.memory.rssMB} MB` : 'Safe'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Global Workspace Table */}
      <RegistrationsPage isEmbedded={true} />
    </div>
  );
};
