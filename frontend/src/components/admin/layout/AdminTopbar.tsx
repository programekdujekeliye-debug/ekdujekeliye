'use client';

import React from 'react';
import { useAdmin, getIndiaTodayString, computeDefaultUpcomingEvent } from '../../../features/admin/context/AdminContext';
import { DownloadIcon } from '../../Icons';

interface AdminTopbarProps {
  isSuperAdmin?: boolean;
  onExportClick?: () => void;
  onClearDataClick?: () => void;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({
  isSuperAdmin = false,
  onExportClick,
  onClearDataClick
}) => {
  const { role, selectedProgramId, setSelectedProgramId, programs } = useAdmin();

  const todayStr = getIndiaTodayString();
  const defaultUpcoming = computeDefaultUpcomingEvent(programs);

  const upcomingPrograms = programs.filter(
    (p) =>
      p.status === 'upcoming' ||
      p.status === 'few_seats' ||
      p.status === 'housefull' ||
      p.status === 'date_tba' ||
      p.date === 'TBD' ||
      (p.date && p.date >= todayStr)
  );

  const completedPrograms = programs.filter(
    (p) => p.status === 'completed' || p.status === 'archived' || (p.date && p.date < todayStr && p.date !== 'TBD')
  );

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-9 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{isSuperAdmin ? 'EDKL EventOS' : 'Ek Duje Ke Liye'}</span>
              <span
                className={`text-[10px] px-2 py-0.5 border font-bold rounded-md uppercase ${
                  isSuperAdmin
                    ? 'bg-purple-50 border-purple-200 text-purple-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {isSuperAdmin ? 'SUPER ADMIN' : 'OPERATIONS'}
              </span>
            </h1>
            <p className="text-slate-500 text-xs font-medium">
              {isSuperAdmin
                ? 'Global Management & Financial Command Center'
                : 'Daily Event Operations & Registration Management'}
            </p>
          </div>
        </div>
      </div>

      {/* Context Event Switcher & Actions */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Event:</span>
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
          >
            {upcomingPrograms.length > 0 && (
              <optgroup label="Upcoming Active Events">
                {upcomingPrograms.map((p) => {
                  const isTbd = p.date === 'TBD' || p.status === 'date_tba' || !p.isDateFinal;
                  const isNext = p.id === defaultUpcoming?.id && !isTbd;
                  return (
                    <option key={p.id} value={p.id}>
                      {isNext ? '⚡ NEXT: ' : isTbd ? '🗓️ ' : '🌟 '}
                      {p.city || 'Gujarat'} — {isTbd ? 'Date TBA' : p.date} ({p.name}) [₹{p.price ?? 1500}]
                      {isNext ? ' [UPCOMING]' : ''}
                    </option>
                  );
                })}
              </optgroup>
            )}
            <option value="all">All Events (Global View)</option>
            {completedPrograms.length > 0 && (
              <optgroup label="Past &amp; Completed Events">
                {completedPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    📁 {p.city || 'Surat'} — {p.date} ({p.name}) [₹{p.price ?? 1000}]
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {isSuperAdmin && role === 'superadmin' && onClearDataClick && (
          <button
            onClick={onClearDataClick}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-600/20 cursor-pointer"
          >
            Clear All Data
          </button>
        )}

        {onExportClick && (
          <button
            onClick={onExportClick}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Export Center</span>
          </button>
        )}
      </div>
    </div>
  );
};
