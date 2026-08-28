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
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5 w-full min-w-0">
      {/* Title & Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full md:w-auto">
        <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-8 sm:h-9 w-auto object-contain flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap leading-tight">
            <span>{isSuperAdmin ? 'EDKL EventOS' : 'Ek Duje Ke Liye'}</span>
            <span
              className={`text-[9px] sm:text-[10px] px-2 py-0.5 border font-extrabold rounded-md uppercase tracking-wider flex-shrink-0 ${
                isSuperAdmin
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {isSuperAdmin ? 'SUPER ADMIN' : 'OPERATIONS'}
            </span>
          </h1>
          <p className="text-slate-500 text-[11px] sm:text-xs font-medium leading-normal break-words">
            {isSuperAdmin
              ? 'Global Management & Financial Command Center'
              : 'Daily Event Operations & Registration Management'}
          </p>
        </div>
      </div>

      {/* Context Event Switcher & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto min-w-0">
        {/* Event Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-xs w-full sm:w-auto min-w-0 max-w-full">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex-shrink-0">Event:</span>
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer w-full truncate"
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
            <option value="all">🌐 All Events (Global View)</option>
            {completedPrograms.length > 0 && (
              <optgroup label="Past & Completed Events">
                {completedPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    📁 {p.city || 'Surat'} — {p.date} ({p.name}) [₹{p.price ?? 1000}]
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && role === 'superadmin' && onClearDataClick && (
            <button
              onClick={onClearDataClick}
              className="flex-1 sm:flex-none px-3.5 py-2 min-h-[40px] bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-600/20 cursor-pointer whitespace-nowrap"
            >
              Clear Data
            </button>
          )}

          {onExportClick && (
            <button
              onClick={onExportClick}
              className="flex-1 sm:flex-none px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <DownloadIcon className="w-4 h-4 flex-shrink-0" />
              <span>Export Center</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
