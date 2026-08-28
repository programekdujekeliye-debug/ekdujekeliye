'use client';

import React from 'react';
import { useAdmin, computeDefaultUpcomingEvent } from '../../../features/admin/context/AdminContext';
import { EventSelectorDropdown } from './EventSelectorDropdown';

interface AdminTopbarProps {
  isSuperAdmin?: boolean;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({
  isSuperAdmin = false
}) => {
  const { selectedProgramId, setSelectedProgramId, programs } = useAdmin();
  const defaultUpcoming = computeDefaultUpcomingEvent(programs);

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 border-b border-slate-200 pb-3 md:pb-5 w-full min-w-0">
      {/* Title & Badge (Desktop Only to avoid duplicate header on mobile) */}
      <div className="hidden md:flex items-center gap-2.5 sm:gap-3 min-w-0 w-full md:w-auto">
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

      {/* Context Event Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto min-w-0">
        <EventSelectorDropdown
          programs={programs}
          selectedProgramId={selectedProgramId}
          onSelectProgram={setSelectedProgramId}
          defaultUpcoming={defaultUpcoming}
        />
      </div>
    </div>
  );
};
