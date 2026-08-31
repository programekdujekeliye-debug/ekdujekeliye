'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { dashboardApi } from '../../../services/admin/dashboardApi';
import { RegistrationsPage } from '../registrations/RegistrationsPage';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  UsersIcon,
  CalendarIcon,
  BuildingIcon
} from '../../../components/Icons';

export const DashboardPage = () => {
  const { selectedProgramId, programs } = useAdmin();
  const [totalInquiries, setTotalInquiries] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [rejectedCount, setRejectedCount] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(1184);
  const [availableSlots, setAvailableSlots] = useState<number>(1184);
  const [isHousefull, setIsHousefull] = useState<boolean>(false);
  const [latestTokenId, setLatestTokenId] = useState<string>('N/A');
  const [selectedEventName, setSelectedEventName] = useState<string>('');

  const fetchStats = async () => {
    try {
      const data: any = await dashboardApi.getAdminDashboard(selectedProgramId);
      if (data && data.stats) {
        const total = data.stats.total || 0;
        const app = data.stats.approved || 0;
        const pend = data.stats.pending || 0;
        const rej = data.stats.rejected || 0;
        const cap = data.stats.capacity || 1184;
        const avail = data.stats.availableSlots !== undefined ? data.stats.availableSlots : Math.max(0, cap - app);
        const housefull = data.stats.isHousefull || app >= cap;

        setTotalInquiries(total);
        setApprovedCount(app);
        setPendingCount(pend);
        setRejectedCount(rej);
        setCapacity(cap);
        setAvailableSlots(avail);
        setIsHousefull(housefull);

        if (data.selectedEvent) {
          setSelectedEventName(`${data.selectedEvent.name} (${data.selectedEvent.date})`);
        } else {
          const matched = programs.find((p) => p.id === selectedProgramId || p.slug === selectedProgramId);
          setSelectedEventName(matched ? `${matched.name} (${matched.date})` : 'All Events Scope');
        }

        if (data.recentSubmissions && data.recentSubmissions.length > 0) {
          setLatestTokenId(data.recentSubmissions[0].inquiryId);
        }
      }
    } catch (err) {
      console.error('Failed to load operational stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedProgramId, programs]);

  const fillPercentage = Math.min(100, Math.round((approvedCount / capacity) * 100));

  return (
    <div className="space-y-6">
      
      {/* Event Scope & Capacity Fill Banner */}
      <div className={`p-4 sm:p-5 rounded-3xl border transition-all ${
        isHousefull
          ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-300/60'
          : 'bg-white border-stone-200/90 shadow-xs'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200">
                {selectedProgramId === 'all' || !selectedProgramId ? 'Global Overview' : 'Selected Event Slot'}
              </span>
              {isHousefull ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-rose-600 text-white shadow-xs animate-pulse">
                  🚨 HOUSEFULL / SOLD OUT
                </span>
              ) : fillPercentage >= 85 ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-amber-500 text-white shadow-xs">
                  ⚡ Few Seats Left
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-600 text-white shadow-xs">
                  ✓ Open For Registrations
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-stone-900 text-base leading-tight">
              {selectedEventName || 'All Events Combined'}
            </h3>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <div className="text-xs font-bold text-stone-600">
              Capacity: <span className="font-mono font-extrabold text-stone-900 text-sm">{approvedCount}</span> / {capacity} couples
            </div>
            <div className="text-[11px] font-semibold text-stone-500">
              {isHousefull ? (
                <span className="text-rose-700 font-bold">0 slots remaining (Capacity Full)</span>
              ) : (
                <span className="text-emerald-700 font-bold">{availableSlots} slots remaining</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Progress Fill Bar */}
        <div className="mt-3 w-full bg-stone-100 border border-stone-200/80 rounded-full h-3 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHousefull
                ? 'bg-rose-600'
                : fillPercentage >= 85
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${fillPercentage}%` }}
          />
        </div>
      </div>

      {/* Operational Metric Cards (4 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider block">Total Inquiries</span>
          <span className="text-2xl sm:text-3xl font-black text-stone-900 block truncate">{totalInquiries}</span>
          <span className="text-[10px] sm:text-[11px] text-stone-400 font-medium block truncate">Total couple entries received</span>
        </div>

        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider block">Approved Passes</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-600 block truncate">{approvedCount}</span>
          <span className="text-[10px] sm:text-[11px] text-emerald-700/80 font-medium block truncate">Confirmed &amp; active passes</span>
        </div>

        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider block">Pending Review</span>
          <span className="text-2xl sm:text-3xl font-black text-amber-600 block truncate">{pendingCount}</span>
          <span className="text-[10px] sm:text-[11px] text-amber-700/80 font-medium block truncate">Awaiting review or payment</span>
        </div>

        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider block">Rejected / Failed</span>
          <span className="text-2xl sm:text-3xl font-black text-rose-600 block truncate">{rejectedCount}</span>
          <span className="text-[10px] sm:text-[11px] text-rose-600/80 font-medium block truncate">Declined or payment failed</span>
        </div>
      </div>

      {/* Registrations & Inquiries Table View */}
      <RegistrationsPage isEmbedded={true} />
    </div>
  );
};
