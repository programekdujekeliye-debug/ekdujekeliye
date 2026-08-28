'use client';

import React from 'react';
import { useAdmin, computeDefaultUpcomingEvent } from '../../../features/admin/context/AdminContext';
import { DownloadIcon } from '../../Icons';
import { EventSelectorDropdown } from './EventSelectorDropdown';

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
  const defaultUpcoming = computeDefaultUpcomingEvent(programs);

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
        {/* Custom Formatted Event Dropdown */}
        <EventSelectorDropdown
          programs={programs}
          selectedProgramId={selectedProgramId}
          onSelectProgram={setSelectedProgramId}
          defaultUpcoming={defaultUpcoming}
        />

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
