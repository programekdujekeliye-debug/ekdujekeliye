'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Program } from '../../../types';
import {
  CalendarIcon,
  MapPinIcon,
  ChevronDownIcon,
  CheckIcon,
  LayersIcon
} from '../../Icons';

interface EventSelectorDropdownProps {
  programs: Program[];
  selectedProgramId: string;
  onSelectProgram: (id: string) => void;
  defaultUpcoming?: Program | null;
}

export const EventSelectorDropdown: React.FC<EventSelectorDropdownProps> = ({
  programs,
  selectedProgramId,
  onSelectProgram,
  defaultUpcoming
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const todayStr = new Date().toISOString().split('T')[0];

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

  const currentProgram = programs.find((p) => p.id === selectedProgramId);
  const isGlobalView = selectedProgramId === 'all';

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-auto min-w-0">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto min-h-[42px] px-3.5 py-2 bg-white border ${
          isOpen ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-300 hover:border-slate-400'
        } rounded-xl shadow-xs transition-all flex items-center justify-between gap-3 text-left cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center justify-center flex-shrink-0 text-rose-700">
            {isGlobalView ? (
              <LayersIcon className="w-3.5 h-3.5" />
            ) : (
              <CalendarIcon className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block">
              {isGlobalView ? 'Scope' : 'Active Event'}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-900 truncate">
                {isGlobalView ? (
                  'All Events (Global View)'
                ) : (
                  <>
                    {currentProgram?.city || 'Gujarat'} &bull; {currentProgram?.date === 'TBD' ? 'Date TBA' : currentProgram?.date} ({currentProgram?.name})
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <ChevronDownIcon
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-rose-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Overlay / Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-[380px] md:w-[420px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center px-3.5 py-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Select Event Workspace
            </span>
            <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
              {programs.length} total
            </span>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 p-1.5 space-y-1">
            {/* Global Workspace Option */}
            <div className="pb-1">
              <button
                type="button"
                onClick={() => {
                  onSelectProgram('all');
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isGlobalView
                    ? 'bg-rose-50/80 border border-rose-200/80 text-rose-900 font-bold'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isGlobalView ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <LayersIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 truncate">All Events</span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        Global
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">Unified cross-event data &amp; reporting</p>
                  </div>
                </div>
                {isGlobalView && <CheckIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />}
              </button>
            </div>

            {/* Upcoming Active Events Group */}
            {upcomingPrograms.length > 0 && (
              <div className="pt-2 space-y-1">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                  <span>Upcoming &amp; Active Events</span>
                </div>
                {upcomingPrograms.map((p) => {
                  const isSelected = selectedProgramId === p.id;
                  const isTbd = p.date === 'TBD' || p.status === 'date_tba' || !p.isDateFinal;
                  const isNext = p.id === defaultUpcoming?.id && !isTbd;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectProgram(p.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50/80 border border-rose-200/80 text-rose-900'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}>
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {p.city || 'Gujarat'} &bull; {p.name}
                            </span>
                            {isNext && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Next Upcoming
                              </span>
                            )}
                            {isTbd && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Date TBA
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-medium">{isTbd ? 'Date to be announced' : p.date}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-slate-700">₹{p.price ?? 1500}</span>
                            {p.venue && (
                              <>
                                <span>&bull;</span>
                                <span className="truncate max-w-[120px] text-slate-400">{p.venue}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSelected && <CheckIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Past & Completed Events Group */}
            {completedPrograms.length > 0 && (
              <div className="pt-2 space-y-1">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Past &amp; Completed Events</span>
                </div>
                {completedPrograms.map((p) => {
                  const isSelected = selectedProgramId === p.id;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectProgram(p.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100 border border-slate-300 text-slate-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <MapPinIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {p.city || 'Surat'} &bull; {p.name}
                            </span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Completed
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span>{p.date}</span>
                            <span>&bull;</span>
                            <span>₹{p.price ?? 1000}</span>
                          </div>
                        </div>
                      </div>
                      {isSelected && <CheckIcon className="w-4 h-4 text-slate-800 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
