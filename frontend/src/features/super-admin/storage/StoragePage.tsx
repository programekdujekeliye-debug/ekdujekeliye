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

    // Auto-refresh candidate progress every 20 seconds while on this page
    const interval = setInterval(() => {
      fetchCandidates();
      fetchTelemetry();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === 'jobs') fetchJobs(1);
    if (tab === 'backups') fetchBackups();
  }, [tab, jobStatusFilter, selectedProgramId]);

  const [operatingEventId, setOperatingEventId] = useState<string | null>(null);

  const handleStartArchive = async (eventId: string) => {
    if (!confirm('Start automatic Google Drive archive for this completed event? The worker will process batches automatically.')) return;
    try {
      setOperatingEventId(eventId);
      const res = await archiveApi.startEventArchive(eventId);
      alert(res.message);
      fetchCandidates();
      fetchJobs(1);
    } catch (err: any) {
      alert(err.message || 'Failed to start archive.');
    } finally {
      setOperatingEventId(null);
    }
  };

  const handlePauseArchive = async (eventId: string) => {
    try {
      setOperatingEventId(eventId);
      const res = await archiveApi.pauseEventArchive(eventId);
      alert(res.message);
      fetchCandidates();
    } catch (err: any) {
      alert(err.message || 'Failed to pause archive.');
    } finally {
      setOperatingEventId(null);
    }
  };

  const handleResumeArchive = async (eventId: string) => {
    try {
      setOperatingEventId(eventId);
      const res = await archiveApi.resumeEventArchive(eventId);
      alert(res.message);
      fetchCandidates();
    } catch (err: any) {
      alert(err.message || 'Failed to resume archive.');
    } finally {
      setOperatingEventId(null);
    }
  };

  const handleRetryEventFailed = async (eventId: string) => {
    try {
      setOperatingEventId(eventId);
      const res = await archiveApi.retryEventFailed(eventId);
      alert(res.message);
      fetchCandidates();
      fetchJobs(1);
    } catch (err: any) {
      alert(err.message || 'Failed to retry failed jobs.');
    } finally {
      setOperatingEventId(null);
    }
  };

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

  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const handleRunBackup = async () => {
    if (runningBackup) return;
    if (!confirm('Generate an immediate compressed database snapshot with SHA-256 integrity verification?')) return;
    try {
      setRunningBackup(true);
      setBackupNotice(null);
      const res = await backupsApi.runBackupNow('manual');
      setBackupNotice('Created — waiting for Drive sync');
      fetchBackups();
    } catch (err: any) {
      alert(err.message || 'Backup failed.');
    } finally {
      setRunningBackup(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white border border-slate-200 p-4 sm:p-5 lg:p-6 rounded-2xl shadow-xs min-w-0 w-full">
        <div className="min-w-0 flex-1 w-full">
          <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 flex flex-wrap items-center gap-2 leading-tight break-words">
            <ArchiveIcon className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span>Google Drive Archive &amp; Database Backups</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-medium leading-normal break-words">
            Zero-cost event media archiving directly to Google Drive (5TB) and cryptographic database snapshots.
          </p>
          {backupNotice && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold break-words">
              <span>⏳ {backupNotice}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleRunBackup}
            disabled={runningBackup}
            className="flex-1 sm:flex-none px-4 py-2.5 min-h-[42px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap"
          >
            <ShieldCheckIcon className="w-4 h-4 flex-shrink-0" />
            <span>{runningBackup ? 'Generating...' : 'Run Backup Now'}</span>
          </button>
        </div>
      </div>

      {/* Top Storage Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
        {/* Cloudinary Quota */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Cloudinary Media</span>
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
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block truncate">
            {resources?.cloudinary?.creditsUsed !== undefined ? `${resources.cloudinary.creditsUsed} / 25` : 'Active'}
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">
            Credits &bull; {resources?.cloudinary?.storageMB ? `${resources.cloudinary.storageMB} MB stored` : 'Active'}
          </span>
        </div>

        {/* Google Drive Status */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Google Drive Archive</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-purple-700 block truncate">5TB Dedicated</span>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">Apps Script Worker Ready</span>
        </div>

        {/* MongoDB Atlas Free Tier */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
          <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">MongoDB Storage</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 block truncate">
            {dbStats ? `${dbStats.storageSizeMB.toFixed(1)} MB` : '...'}
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">
            {dbStats ? `${((dbStats.storageSizeMB / dbStats.totalLimitMB) * 100).toFixed(1)}% of 512 MB Free Limit` : '...'}
          </span>
        </div>

        {/* Archive Queue Health */}
        <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
          <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Archive Worker Queue</span>
          <div className="flex items-center gap-3 mt-1">
            <div>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-600">{jobsSummary.VERIFIED || 0}</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 block font-bold">VERIFIED</span>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <span className="text-xl sm:text-2xl font-extrabold text-amber-600">{jobsSummary.QUEUED || 0}</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 block font-bold">QUEUED</span>
            </div>
            {jobsSummary.FAILED > 0 && (
              <div className="border-l border-slate-200 pl-3">
                <span className="text-xl sm:text-2xl font-extrabold text-red-600">{jobsSummary.FAILED}</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 block font-bold">FAILED</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row bg-slate-200/70 p-1.5 rounded-2xl gap-1.5 shadow-inner">
        <button
          onClick={() => setTab('candidates')}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            tab === 'candidates' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Archive Candidates ({candidates.length})
        </button>
        <button
          onClick={() => setTab('jobs')}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            tab === 'jobs' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Live Queue ({totalJobs})
        </button>
        <button
          onClick={() => setTab('backups')}
          className={`flex-1 py-2 px-3 text-center rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            tab === 'backups' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Database Backups ({totalBackups})
        </button>
      </div>

      {/* Tab 1: Candidates View */}
      {tab === 'candidates' && (
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Completed &amp; Historical Event Candidates</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Select events to discover couple photos and queue them for direct Google Drive transfer.
              </p>
            </div>
            <button
              onClick={fetchCandidates}
              className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
            >
              <RefreshCwIcon className={`w-4 h-4 ${loadingCandidates ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {candidates.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No event records found.</p>
            ) : (
              candidates.map((cand) => {
                const isArchiving = cand.archiveStatus === 'ARCHIVING';
                const isPaused = cand.archiveStatus === 'PAUSED';
                const isCompletedArchive = cand.archiveStatus === 'COMPLETED' || (cand.archivedAssets >= cand.eligibleCouplePhotos && cand.eligibleCouplePhotos > 0 && (cand.queuedAssets || 0) === 0 && (cand.copyingAssets || 0) === 0);
                const isPartial = cand.archiveStatus === 'PARTIAL' || (Boolean(cand.failedAssets) && cand.failedAssets! > 0);

                return (
                  <div
                    key={cand.id}
                    className={`py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 rounded-xl transition-colors border ${
                      isArchiving
                        ? 'bg-purple-50/40 border-purple-200'
                        : isCompletedArchive
                        ? 'bg-emerald-50/20 border-emerald-100'
                        : 'hover:bg-slate-50/60 border-slate-100'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate">{cand.name}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md uppercase">
                          {cand.city} &bull; {cand.date}
                        </span>
                        {isArchiving && (
                          <span className="text-[10px] px-2.5 py-0.5 bg-purple-600 text-white font-extrabold rounded-full uppercase tracking-wider animate-pulse whitespace-nowrap">
                            CURRENT ARCHIVE
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 font-extrabold rounded-md uppercase whitespace-nowrap ${
                            isCompletedArchive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : isArchiving
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : isPaused
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : isPartial
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cand.archiveStatus}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-4 flex-wrap">
                        <span>📸 Eligible: <strong>{cand.eligibleCouplePhotos}</strong></span>
                        <span>✓ Verified: <strong className="text-emerald-700">{cand.archivedAssets}</strong></span>
                        <span>⏳ Queued: <strong className="text-amber-700">{cand.queuedAssets}</strong></span>
                        <span>⚙️ Copying: <strong className="text-sky-700">{cand.copyingAssets || 0}</strong></span>
                        <span>❌ Failed: <strong className="text-rose-700">{cand.failedAssets || 0}</strong></span>
                        <span>💾 Est. Size: <strong>{cand.estimatedSizeMB} MB</strong></span>
                      </div>

                      {cand.eligibleCouplePhotos > 0 && (
                        <div className="w-full max-w-md pt-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                            <span>Archive Progress</span>
                            <span>
                              {cand.archivedAssets} / {cand.eligibleCouplePhotos} ({cand.progressPercent || Math.min(100, Math.round((cand.archivedAssets / cand.eligibleCouplePhotos) * 100))}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-600 to-emerald-500 transition-all duration-300"
                              style={{ width: `${cand.progressPercent || Math.min(100, Math.round((cand.archivedAssets / cand.eligibleCouplePhotos) * 100))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                      {!cand.isCompleted ? (
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">
                          Upcoming Event
                        </span>
                      ) : isCompletedArchive ? (
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-extrabold flex items-center gap-1 whitespace-nowrap">
                          ✓ Drive Archive Complete
                        </span>
                      ) : isArchiving ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-xl text-xs font-extrabold animate-pulse">
                            Archiving...
                          </span>
                          <button
                            onClick={() => handlePauseArchive(cand.id)}
                            disabled={operatingEventId === cand.id}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 cursor-pointer"
                          >
                            Pause
                          </button>
                        </div>
                      ) : isPaused ? (
                        <button
                          onClick={() => handleResumeArchive(cand.id)}
                          disabled={operatingEventId === cand.id}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Resume Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartArchive(cand.id)}
                          disabled={operatingEventId === cand.id}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer whitespace-nowrap"
                        >
                          Start Drive Archive
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Live Archive Queue */}
      {tab === 'jobs' && (
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl overflow-hidden space-y-4 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Real-Time Media Asset State Machine</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Atomic state machine: QUEUED &rarr; COPYING &rarr; VERIFIED &rarr; ARCHIVED
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 flex-1 sm:flex-none min-h-[38px]"
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
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 cursor-pointer min-h-[38px] whitespace-nowrap"
                >
                  Retry Failed ({jobsSummary.FAILED})
                </button>
              )}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Registration / File</th>
                  <th className="px-4 py-3">Drive Original</th>
                  <th className="px-4 py-3">Operational Thumbnail</th>
                  <th className="px-4 py-3">Cloudinary Original</th>
                  <th className="px-4 py-3">Archive Status</th>
                  <th className="px-4 py-3">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loadingJobs && jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">Loading jobs...</td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No archive jobs recorded.</td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const isVerifiedDrive = Boolean(job.driveFileId && (job.status === 'VERIFIED' || job.status === 'ARCHIVED'));
                    const hasThumb = Boolean(job.operationalThumbnailUrl);
                    const originalStatus = job.cloudinaryOriginalStatus || 'ACTIVE';

                    return (
                      <tr key={job._id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 block">{job.filename}</span>
                          <span className="text-[10px] text-purple-700 font-mono font-bold">{job.registrationId || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px]">
                          {isVerifiedDrive ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              ✓ Verified <span className="text-slate-400 font-normal">({job.driveFileId?.slice(0, 10)}...)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Pending Drive archive</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {hasThumb ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={job.operationalThumbnailUrl}
                                alt="Thumb"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs"
                              />
                              <span className="text-emerald-700 font-bold text-[10px]">✓ Cloudinary</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Not generated</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${
                              originalStatus === 'DELETED'
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : originalStatus === 'DELETE_READY'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {originalStatus}
                          </span>
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
                        <td className="px-4 py-3 text-slate-600 text-[11px]">
                          {job.originalSize ? `${(job.originalSize / 1024).toFixed(1)} KB` : '...'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card View (< lg screens) */}
          <div className="lg:hidden space-y-3">
            {loadingJobs && jobs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-medium text-xs">Loading jobs...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-medium text-xs">No archive jobs recorded.</div>
            ) : (
              jobs.map((job) => {
                const isVerifiedDrive = Boolean(job.driveFileId && (job.status === 'VERIFIED' || job.status === 'ARCHIVED'));
                const hasThumb = Boolean(job.operationalThumbnailUrl);

                return (
                  <div key={job._id} className="p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div>
                        <span className="font-mono font-bold text-purple-700 text-xs">{job.registrationId || 'N/A'}</span>
                        <span className="font-semibold text-slate-800 text-xs block truncate max-w-[200px]">{job.filename}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase whitespace-nowrap ${
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
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Drive: {isVerifiedDrive ? '✓ Verified' : 'Pending'}</span>
                      <span>Size: {job.originalSize ? `${(job.originalSize / 1024).toFixed(1)} KB` : '...'}</span>
                      {hasThumb && <span className="text-emerald-700 font-bold">✓ Thumbnail</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {jobsTotalPages > 1 && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span>Page {jobsPage} of {jobsTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={jobsPage <= 1}
                  onClick={() => fetchJobs(jobsPage - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={jobsPage >= jobsTotalPages}
                  onClick={() => fetchJobs(jobsPage + 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold cursor-pointer"
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
        <div className="space-y-6">
          {/* Automation Dashboard Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-700/50 space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <h3 className="text-base font-extrabold tracking-wide">Production Backup Automation Architecture</h3>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  Autonomous Google Apps Script cloud orchestrator with deterministic period idempotency.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] sm:text-[11px] font-bold">
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 rounded-xl whitespace-nowrap">
                  Scheduler: Apps Script (11 PM IST)
                </span>
                <span className="px-3 py-1 bg-slate-700/60 border border-slate-600 text-slate-300 rounded-xl whitespace-nowrap">
                  Backend Cron: Disabled
                </span>
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/40 text-purple-300 rounded-xl whitespace-nowrap">
                  Laptop Required: NO
                </span>
              </div>
            </div>

            {/* Tier Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Daily Tier */}
              {(() => {
                const daily = backups.find(b => b.type === 'daily');
                const isV = daily?.status === 'verified';
                return (
                  <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Daily Tier</span>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase ${isV ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {isV ? '✓ Drive Verified' : daily ? daily.status.toUpperCase() : 'Pending'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-100">
                      Period: <span className="font-mono text-indigo-300">{daily?.periodKey || '2026-08-28'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      {daily ? daily.backupId : 'No scheduled run yet'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Frequency: Every calendar night (Asia/Kolkata)
                    </div>
                  </div>
                );
              })()}

              {/* Weekly Tier */}
              {(() => {
                const weekly = backups.find(b => b.type === 'weekly');
                const isV = weekly?.status === 'verified';
                return (
                  <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Tier</span>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase ${isV ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {isV ? '✓ Drive Verified' : weekly ? weekly.status.toUpperCase() : 'Pending'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-100">
                      Period: <span className="font-mono text-indigo-300">{weekly?.periodKey || '2026-W35'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      {weekly ? weekly.backupId : 'Sunday night cascade'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Frequency: Every Sunday night IST
                    </div>
                  </div>
                );
              })()}

              {/* Monthly Tier */}
              {(() => {
                const monthly = backups.find(b => b.type === 'monthly');
                const isV = monthly?.status === 'verified';
                return (
                  <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly Tier</span>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase ${isV ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {isV ? '✓ Drive Verified' : monthly ? monthly.status.toUpperCase() : 'Pending'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-100">
                      Period: <span className="font-mono text-indigo-300">{monthly?.periodKey || '2026-08'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      {monthly ? monthly.backupId : '1st of month cascade'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Frequency: 1st of every calendar month IST
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Database Backups Table & Card View */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl overflow-hidden space-y-4 p-4 sm:p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Database Snapshots &amp; Cryptographic Manifests</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Every snapshot is compressed via gzip and verified with SHA-256 hashes before Drive archival.
                </p>
              </div>
              <button
                onClick={fetchBackups}
                className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
              >
                <RefreshCwIcon className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
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
                    backups.map((b) => {
                      const isVerified = b.status === 'verified' && Boolean(b.driveFileId);
                      const isSyncing = b.status === 'pending' || b.status === 'syncing';
                      const isFailed = b.status === 'failed' || b.status === 'sync_failed';

                      return (
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
                            <span
                              className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border ${
                                isVerified
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isSyncing
                                  ? 'bg-sky-50 text-sky-800 border-sky-200 animate-pulse'
                                  : isFailed
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {isVerified
                                ? 'DRIVE VERIFIED'
                                : isSyncing
                                ? 'SYNCING'
                                : isFailed
                                ? 'SYNC FAILED'
                                : 'LOCAL ONLY'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {b.size ? `${(b.size / 1024).toFixed(1)} KB` : '...'}
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                            {b.checksum ? `${b.checksum.slice(0, 14)}...` : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isVerified ? (
                                <>
                                  <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                    ✓ Google Drive Verified
                                  </span>
                                  {b.driveFolderId && (
                                    <a
                                      href={`https://drive.google.com/drive/folders/${b.driveFolderId}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline"
                                    >
                                      Open Drive Folder ↗
                                    </a>
                                  )}
                                </>
                              ) : isSyncing ? (
                                <span className="text-[10px] text-sky-600 font-medium">Syncing snapshot to Drive...</span>
                              ) : isFailed ? (
                                <span className="text-[10px] text-red-600 font-medium">Drive sync failed ({b.lastError || 'Error'})</span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Drive sync pending</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Backup Cards */}
            <div className="lg:hidden space-y-3">
              {loadingBackups && backups.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs">Loading backups...</div>
              ) : backups.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs">No backup records found.</div>
              ) : (
                backups.map((b) => {
                  const isVerified = b.status === 'verified' && Boolean(b.driveFileId);

                  return (
                    <div key={b._id} className="p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                          {b.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border ${
                            isVerified
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isVerified ? '✓ Verified' : b.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="font-mono font-bold text-slate-900 text-xs block truncate">{b.backupId}</span>
                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                          <span>Size: {b.size ? `${(b.size / 1024).toFixed(1)} KB` : '...'}</span>
                          <span>{new Date(b.startedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {isVerified && b.driveFolderId && (
                        <div className="pt-1 border-t border-slate-100">
                          <a
                            href={`https://drive.google.com/drive/folders/${b.driveFolderId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline block"
                          >
                            Open in Google Drive ↗
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
