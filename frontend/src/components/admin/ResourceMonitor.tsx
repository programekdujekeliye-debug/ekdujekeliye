'use client';

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { RefreshCwIcon, ActivityIcon, DownloadIcon, ShieldCheckIcon } from '../Icons';

interface ResourceData {
  memory: {
    rssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    budgetMB: number;
    status: string;
  };
  database: {
    dataSizeMB: number;
    indexSizeMB: number;
    totalStorageMB: number;
    budgetMB: number;
    providerLimitMB: number;
    percentOfBudget: number;
    status: string;
  };
  cloudinary: {
    creditsUsed: number;
    creditsLimit: number;
    percentUsed: number;
    storageMB: number;
    bandwidthMB: number;
    status: string;
    note?: string;
  };
  googleDriveArchive: {
    status: string;
    pendingArchiveJobs: number;
    failedArchiveJobs: number;
  };
  warnings: Array<{
    code: string;
    level: string;
    message: string;
  }>;
  officialDashboards: {
    render: string;
    mongodb: string;
    cloudinary: string;
  };
}

export const ResourceMonitor = ({ authPassword }: { authPassword: string }) => {
  const [data, setData] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<any | null>(null);

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/admin/system/resources`, {
        headers: { Authorization: `Bearer ${authPassword}` }
      });
      if (!res.ok) throw new Error('Failed to fetch system metrics. Ensure Super Admin privileges.');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error fetching system resources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [authPassword]);

  const handleRunBackup = async () => {
    try {
      setBackingUp(true);
      setBackupResult(null);
      const res = await fetch(`${API_BASE_URL}/api/admin/system/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authPassword}` }
      });
      const result = await res.json();
      if (res.ok) {
        setBackupResult(result.manifest || result);
        fetchResources();
      } else {
        alert(result.error || 'Backup creation failed.');
      }
    } catch (err: any) {
      alert(`Error running backup: ${err.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <ActivityIcon className="w-5 h-5 text-rose-600" />
            Zero-Cost Infrastructure Guardrails &amp; Monitor
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time telemetry tracking memory, database limits, Cloudinary credits, and backup archives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunBackup}
            disabled={backingUp}
            className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>{backingUp ? 'Compressing & Backing Up...' : 'Run Gzip Database Backup'}</span>
          </button>
          <button
            onClick={fetchResources}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Backup Success Toast */}
      {backupResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-1 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 font-bold text-emerald-800">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
            <span>Database Backup Successfully Created &amp; Verified</span>
          </div>
          <p className="text-[11px] font-mono opacity-90">
            File: {backupResult.filename} ({backupResult.compressedSizeKB} KB) | Checksum: {backupResult.checksum?.slice(0, 16)}...
          </p>
        </div>
      )}

      {/* Active System Warnings */}
      {data?.warnings && data.warnings.length > 0 && (
        <div className="space-y-3">
          {data.warnings.map((w, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xs ${
                w.level === 'CRITICAL'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{w.level === 'CRITICAL' ? '🚨' : '⚠️'}</span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">{w.code}</h4>
                  <p className="text-xs mt-0.5 font-medium">{w.message}</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase ${
                w.level === 'CRITICAL' ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {w.level}
              </span>
            </div>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="p-12 text-center text-slate-500 font-medium text-xs">
          Querying backend infrastructure health...
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">
          {error}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Render Memory Card */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Render Backend</span>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                data.memory.status === 'SAFE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                data.memory.status === 'WATCH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {data.memory.status}
              </span>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-slate-900">{data.memory.rssMB} MB</span>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">RSS Memory (Budget: {data.memory.budgetMB} MB)</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Heap Used:</span>
                <span className="font-bold text-slate-800">{data.memory.heapUsedMB} MB</span>
              </div>
              <div className="flex justify-between">
                <span>Heap Total:</span>
                <span>{data.memory.heapTotalMB} MB</span>
              </div>
            </div>
          </div>

          {/* MongoDB Atlas Card */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">MongoDB Atlas</span>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                data.database.status === 'SAFE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                data.database.status === 'WATCH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {data.database.status}
              </span>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-slate-900">{data.database.totalStorageMB} MB</span>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">{data.database.percentOfBudget}% of {data.database.budgetMB} MB Budget</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  data.database.percentOfBudget > 80 ? 'bg-red-500' :
                  data.database.percentOfBudget > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, data.database.percentOfBudget)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium pt-1">
              <span>Data: {data.database.dataSizeMB} MB</span>
              <span>Indexes: {data.database.indexSizeMB} MB</span>
            </div>
          </div>

          {/* Cloudinary Operational Media Card */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cloudinary Media</span>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                data.cloudinary.status === 'SAFE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                data.cloudinary.status === 'WATCH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {data.cloudinary.status}
              </span>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-slate-900">{data.cloudinary.creditsUsed}</span>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">Credits of {data.cloudinary.creditsLimit} Limit ({data.cloudinary.percentUsed}%)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  data.cloudinary.percentUsed > 80 ? 'bg-red-500' :
                  data.cloudinary.percentUsed > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, data.cloudinary.percentUsed)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium pt-1">
              <span>Storage: {data.cloudinary.storageMB} MB</span>
              <span>Bandwidth: {data.cloudinary.bandwidthMB} MB</span>
            </div>
          </div>

          {/* Google Drive Archive Card */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">5TB Google Drive</span>
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 rounded-md uppercase">
                READY
              </span>
            </div>
            <div>
              <span className="text-xl font-extrabold text-slate-900">Archive Worker</span>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">{data.googleDriveArchive.status}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Pending Jobs:</span>
                <span className="font-bold text-slate-800">{data.googleDriveArchive.pendingArchiveJobs}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed Jobs:</span>
                <span className="font-bold text-emerald-600">{data.googleDriveArchive.failedArchiveJobs}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
