import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../admin/context/AdminContext';
import { dashboardApi } from '../../../services/admin/dashboardApi';
import { settingsApi } from '../../../services/admin/settingsApi';
import { DatabaseStats } from '../../../types';
import { RegistrationsPage } from '../../admin/registrations/RegistrationsPage';

export const SuperAdminDashboard = () => {
  const { selectedProgramId } = useAdmin();
  const [totalInquiries, setTotalInquiries] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [latestTokenId, setLatestTokenId] = useState<string>('N/A');
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);

  const fetchCommandStats = async () => {
    try {
      const [dash, db] = await Promise.all([
        dashboardApi.getAdminDashboard(selectedProgramId).catch(() => null),
        settingsApi.getDbStatus().catch(() => null)
      ]);

      if (dash && dash.stats) {
        setTotalInquiries(dash.stats.total || 0);
        setApprovedCount(dash.stats.approved || 0);
        setPendingCount(dash.stats.pending || 0);
        if (dash.recentSubmissions && dash.recentSubmissions.length > 0) {
          setLatestTokenId(dash.recentSubmissions[0].inquiryId);
        }
      }
      if (db) setDbStats(db);
    } catch (err) {
      console.error('Failed to load Super Admin command metrics:', err);
    }
  };

  useEffect(() => {
    fetchCommandStats();
  }, [selectedProgramId]);

  return (
    <div className="space-y-6">
      {/* Top Command Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
        {/* Total Inquiries */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Total Inquiries</span>
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 block truncate">{totalInquiries}</span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block truncate">Latest Token: {latestTokenId}</span>
        </div>

        {/* Approved Passes */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Approved Passes</span>
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-600 block truncate">{approvedCount}</span>
          <span className="text-[10px] sm:text-[11px] text-emerald-600/80 font-medium block truncate">Confirmed couple slots</span>
        </div>

        {/* Pending Review */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Pending Review</span>
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-amber-600 block truncate">{pendingCount}</span>
          <span className="text-[10px] sm:text-[11px] text-amber-600/80 font-medium block truncate">Awaiting verification</span>
        </div>

        {/* MongoDB Database Storage & System Health */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider block">Database &amp; System</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 block truncate">
            {dbStats ? `${(Number(dbStats.storageSizeMB ?? dbStats.dataSizeMB ?? 0)).toFixed(1)} MB / ${Number(dbStats.totalLimitMB || 512)} MB` : 'Loading...'}
          </span>
          {dbStats && (
            <div className="mt-2 space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${
                    (Number(dbStats.storageSizeMB ?? dbStats.dataSizeMB ?? 0) / Number(dbStats.totalLimitMB || 512)) > 0.8 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (Number(dbStats.storageSizeMB ?? dbStats.dataSizeMB ?? 0) / Number(dbStats.totalLimitMB || 512)) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {((Number(dbStats.storageSizeMB ?? dbStats.dataSizeMB ?? 0) / Number(dbStats.totalLimitMB || 512)) * 100).toFixed(1)}% of free tier storage used
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
