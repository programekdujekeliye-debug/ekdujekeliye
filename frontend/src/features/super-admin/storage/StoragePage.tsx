'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../admin/context/AdminContext';
import { archiveApi } from '../../../services/admin/archiveApi';
import { backupsApi } from '../../../services/admin/backupsApi';
import { resourcesApi } from '../../../services/admin/resourcesApi';
import { settingsApi } from '../../../services/admin/settingsApi';
import { ArchiveCandidate, MediaArchiveJob, BackupRecordItem, DatabaseStats } from '../../../types';
import { ArchiveIcon, RefreshCwIcon, ShieldCheckIcon } from '../../../components/Icons';

export const StoragePage = () => {
  const { selectedProgramId } = useAdmin();

  const [tab, setTab] = useState<'candidates' | 'jobs' | 'backups'>('candidates');

  // Telemetry
  const [resources, setResources] = useState<any | null>(null);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);

  // Candidates
  const [candidates, setCandidates] = useState<ArchiveCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [queuingEventId, setQueuingEventId] = useState<string | null>(null);

  // Jobs
  const [jobs, setJobs] = useState<MediaArchiveJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsSummary, setJobsSummary] = useState<any>({ QUEUED: 0, COPYING: 0, VERIFIED: 0, FAILED: 0 });

  // Backups
  const [backups, setBackups] = useState<BackupRecordItem[]>([]);
  const [totalBackups, setTotalBackups] = useState(0);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);

  const fetchTelemetry = async () => {
    try {
      const [res, db] = await Promise.all([
        resourcesApi.getSystemResources().catch(() => null),
        settingsApi.getDbStatus().catch(() => null)
      ]);
      if (res) setResources(res);
      if (db) setDbStats(db);
    } catch (e) {
      console.error('Failed to load storage telemetry:', e);
    }
  };

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const data = await archiveApi.getCandidates();
      setCandidates(data);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const fetchJobs = async (page = 1) => {
    try {
      setLoadingJobs(true);
      const res = await archiveApi.getJobs({
        page,
        limit: 25,
        status: jobStatusFilter,
        eventId: selectedProgramId !== 'all' ? selectedProgramId : undefined
      });
      setJobs(res.jobs || []);
      setTotalJobs(res.total || 0);
      setJobsTotalPages(res.totalPages || 1);
      setJobsPage(res.page || page);
      if (res.summary) setJobsSummary(res.summary);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setLoadingBackups(true);
      const res = await backupsApi.getBackups({ limit: 20 });
      setBackups(res.backups || []);
      setTotalBackups(res.total || 0);
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    fetchCandidates();
  }, []);

  useEffect(() => {
    if (tab === 'jobs') fetchJobs(1);
    if (tab === 'backups') fetchBackups();
  }, [tab, jobStatusFilter, selectedProgramId]);

  const handleQueueEvent = async (eventId: string) => {
    if (!confirm('Queue couple photos from this event for direct Cloudinary -> Google Drive archiving?')) return;
    try {
      setQueuingEventId(eventId);
      const res = await archiveApi.queueEventArchive(eventId);
      alert(res.message);
      fetchCandidates();
      fetchJobs(1);
    } catch (err: any) {
      alert(err.message || 'Failed to queue event for archive.');
    } finally {
      setQueuingEventId(null);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const res = await archiveApi.retryFailed(selectedProgramId !== 'all' ? selectedProgramId : undefined);
      alert(res.message);
      fetchJobs(1);
    } catch (err: any) {
      alert(err.message || 'Failed to retry jobs.');
    }
  };

  const handleRunBackup = async () => {
    if (!confirm('Generate an immediate compressed database snapshot with SHA-256 integrity verification?')) return;
    try {
      setRunningBackup(true);
      const res = await backupsApi.runBackupNow('manual');
      alert(res.message);
      fetchBackups();
    } catch (err: any) {
      alert(err.message || 'Backup failed.');
    } finally {
      setRunningBackup(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <ArchiveIcon className="w-5 h-5 text-purple-600" />
            <span>Google Drive Archive &amp; Database Backups</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Zero-cost event media archiving directly to Google Drive (5TB) and cryptographic database snapshots.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunBackup}
            disabled={runningBackup}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <ShieldCheckIcon className="w-4 h-4" />
            <span>{runningBackup ? 'Generating Snapshot...' : 'Run Backup Now'}</span>
          </button>
        </div>
      </div>

      {/* Overview Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Cloudinary Quota */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cloudinary Media</span>
            {resources?.cloudinary?.status && (
              <span
                className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase ${
                  resources.cloudinary.status === 'SAFE'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {resources.cloudinary.status}
              </span>
            )}
          </div>
          <span className="text-3xl font-extrabold text-slate-900 block">
            {resources?.cloudinary?.creditsUsed !== undefined ? `${resources.cloudinary.creditsUsed} / 25` : 'Active'}
          </span>
          <span className="text-[11px] text-slate-500 font-medium block">
            Credits &bull; {resources?.cloudinary?.storageMB ? `${resources.cloudinary.storageMB} MB stored` : 'Active'}
          </span>
        </div>

        {/* Google Drive Status */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Google Drive Archive</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <span className="text-2xl font-extrabold text-purple-700 block">5TB Dedicated</span>
          <span className="text-[11px] text-slate-500 font-medium block">Google Apps Script Worker Ready</span>
        </div>

        {/* MongoDB Atlas Free Tier */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">MongoDB Storage</span>
          <span className="text-2xl font-extrabold text-slate-900 block">
            {dbStats ? `${dbStats.storageSizeMB.toFixed(1)} MB` : '...'}
          </span>
          <span className="text-[11px] text-slate-500 font-medium block">
            {dbStats ? `${((dbStats.storageSizeMB / dbStats.totalLimitMB) * 100).toFixed(1)}% of 512 MB Free Limit` : '...'}
          </span>
        </div>

        {/* Archive Queue Health */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Archive Worker Queue</span>
          <div className="flex items-center gap-3 mt-1">
            <div>
              <span className="text-2xl font-extrabold text-emerald-600">{jobsSummary.VERIFIED || 0}</span>
              <span className="text-[10px] text-slate-400 block font-bold">VERIFIED</span>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <span className="text-2xl font-extrabold text-amber-600">{jobsSummary.QUEUED || 0}</span>
              <span className="text-[10px] text-slate-400 block font-bold">QUEUED</span>
            </div>
            {jobsSummary.FAILED > 0 && (
              <div className="border-l border-slate-200 pl-3">
                <span className="text-2xl font-extrabold text-red-600">{jobsSummary.FAILED}</span>
                <span className="text-[10px] text-slate-400 block font-bold">FAILED</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex bg-slate-200/70 p-1.5 rounded-2xl gap-2 shadow-inner">
        <button
          onClick={() => setTab('candidates')}
          className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tab === 'candidates' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Archive Candidates ({candidates.length})
        </button>
        <button
          onClick={() => setTab('jobs')}
          className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tab === 'jobs' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Live Archive Queue ({totalJobs})
        </button>
        <button
          onClick={() => setTab('backups')}
          className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tab === 'backups' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Database Backups Ledger ({totalBackups})
        </button>
      </div>

      {/* Tab 1: Candidates View */}
      {tab === 'candidates' && (
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Completed &amp; Historical Event Candidates</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Select events to discover couple photos and queue them for direct Google Drive transfer.
              </p>
            </div>
            <button
              onClick={fetchCandidates}
              className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl"
            >
              <RefreshCwIcon className={`w-4 h-4 ${loadingCandidates ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {candidates.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No event records found.</p>
            ) : (
              candidates.map((cand) => (
                <div
                  key={cand.id}
                  className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/60 p-3 rounded-xl transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{cand.name}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md uppercase">
                        {cand.city} &bull; {cand.date}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 font-extrabold rounded-md uppercase ${
                          cand.archiveStatus === 'ARCHIVED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : cand.archiveStatus === 'QUEUED'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cand.archiveStatus}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-4 flex-wrap">
                      <span>📸 Couple Photos: <strong>{cand.eligibleCouplePhotos}</strong></span>
                      <span>💾 Est. Size: <strong>{cand.estimatedSizeMB} MB</strong></span>
                      <span>✓ Verified in Drive: <strong>{cand.archivedAssets}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleQueueEvent(cand.id)}
                      disabled={queuingEventId === cand.id || cand.eligibleCouplePhotos === 0}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      {queuingEventId === cand.id ? 'Queuing Assets...' : 'Queue Archive'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Jobs Queue Table */}
      {tab === 'jobs' && (
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Media Archive Jobs Ledger</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Atomic state machine: QUEUED &rarr; COPYING &rarr; VERIFIED &rarr; ARCHIVED
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
              >
                <option value="all">All Statuses</option>
                <option value="QUEUED">QUEUED</option>
                <option value="COPYING">COPYING</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="FAILED">FAILED</option>
              </select>
              {jobsSummary.FAILED > 0 && (
                <button
                  onClick={handleRetryFailed}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 cursor-pointer"
                >
                  Retry Failed ({jobsSummary.FAILED})
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Token / File</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Source Provider</th>
                  <th className="px-4 py-3">Drive File ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loadingJobs && jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">Loading jobs...</td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No archive jobs recorded.</td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job._id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{job.filename}</span>
                        <span className="text-[10px] text-purple-700 font-mono">{job.registrationId || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{job.eventId}</td>
                      <td className="px-4 py-3 uppercase text-[10px] font-bold text-slate-500">{job.sourceProvider}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-600">
                        {job.driveFileId ? (
                          <span className="text-emerald-700 font-bold">✓ {job.driveFileId.slice(0, 16)}...</span>
                        ) : (
                          <span className="text-slate-400">Pending upload</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${
                            job.status === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : job.status === 'FAILED'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : job.status === 'COPYING'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{job.attempts}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {job.originalSize ? `${(job.originalSize / 1024).toFixed(1)} KB` : '...'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {jobsTotalPages > 1 && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span>Page {jobsPage} of {jobsTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={jobsPage <= 1}
                  onClick={() => fetchJobs(jobsPage - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold"
                >
                  Previous
                </button>
                <button
                  disabled={jobsPage >= jobsTotalPages}
                  onClick={() => fetchJobs(jobsPage + 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Database Backups Ledger */}
      {tab === 'backups' && (
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl overflow-hidden space-y-4 p-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Database Snapshots &amp; Cryptographic Manifests</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Every snapshot is compressed via gzip and verified with SHA-256 hashes before Drive archival.
              </p>
            </div>
            <button
              onClick={fetchBackups}
              className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl"
            >
              <RefreshCwIcon className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Backup ID / Timestamp</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">SHA-256 Checksum</th>
                  <th className="px-4 py-3">Drive Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loadingBackups && backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">Loading backups...</td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No backup records found.</td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block font-mono text-[11px]">{b.backupId}</span>
                        <span className="text-[10px] text-slate-400">{new Date(b.startedAt).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                          {b.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {b.size ? `${(b.size / 1024).toFixed(1)} KB` : '...'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                        {b.checksum ? `${b.checksum.slice(0, 14)}...` : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {b.driveFileId ? (
                          <span className="text-[10px] font-bold text-emerald-700">✓ In Drive</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Render disk / Drive sync pending</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
