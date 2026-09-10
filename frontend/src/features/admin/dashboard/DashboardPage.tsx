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
import { formatToDDMMYYYY } from '../../../utils/dateFormat';

export const DashboardPage = () => {
  const { selectedProgramId, programs, loadingPrograms } = useAdmin();
  const [totalInquiries, setTotalInquiries] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [rejectedCount, setRejectedCount] = useState<number>(0);
  const [regularTotal, setRegularTotal] = useState<number>(0);
  const [vipTotal, setVipTotal] = useState<number>(0);
  const [regularApproved, setRegularApproved] = useState<number>(0);
  const [vipApproved, setVipApproved] = useState<number>(0);
  const [presentCount, setPresentCount] = useState<number>(0);
  const [attendanceRate, setAttendanceRate] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(1184);
  const [availableSlots, setAvailableSlots] = useState<number>(1184);
  const [isHousefull, setIsHousefull] = useState<boolean>(false);
  const [eventStatus, setEventStatus] = useState<string>('upcoming');
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
        const regTot = data.stats.regularTotal || 0;
        const vTot = data.stats.vipTotal || 0;
        const regApp = data.stats.regularApproved || 0;
        const vApp = data.stats.vipApproved || 0;
        const matched = programs.find((p) => p.id === selectedProgramId || p.slug === selectedProgramId);
        const cap = matched?.capacity && matched.capacity > 0 ? matched.capacity : (data.selectedEvent?.capacity || data.stats.capacity || 1000);
        const rawStatus = matched?.status || data.selectedEvent?.status || data.stats.status || 'upcoming';
        const isCapacityFull = cap > 0 && app >= cap;
        const housefull = isCapacityFull;
        const isClosed = rawStatus === 'registration_closed' || Boolean(data.stats.isClosed);
        const effectiveStatus = isCapacityFull
          ? 'housefull'
          : rawStatus === 'housefull'
          ? (cap > 0 && app / cap >= 0.85 ? 'few_seats' : 'upcoming')
          : rawStatus;
        const avail = (housefull || isClosed) ? 0 : Math.max(0, cap - app);

        setTotalInquiries(total);
        setApprovedCount(app);
        setPendingCount(pend);
        setRejectedCount(rej);
        setPresentCount(data.stats.present || 0);
        setAttendanceRate(data.stats.attendanceRate || 0);
        setRegularTotal(regTot);
        setVipTotal(vTot);
        setRegularApproved(regApp);
        setVipApproved(vApp);
        setCapacity(cap);
        setAvailableSlots(avail);
        setIsHousefull(housefull);
        setEventStatus(effectiveStatus);

        if (data.selectedEvent) {
          setSelectedEventName(`${data.selectedEvent.name} (${formatToDDMMYYYY(data.selectedEvent.date)})`);
        } else if (matched) {
          setSelectedEventName(`${matched.name} (${formatToDDMMYYYY(matched.date)})`);
        } else {
          setSelectedEventName('All Events Scope');
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
    if (loadingPrograms && !selectedProgramId) return;
    fetchStats();

    // Fast 4-second live heartbeat for gate attendance synchronization
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchStats();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedProgramId, programs, loadingPrograms]);

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
              ) : eventStatus === 'registration_closed' ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-stone-600 text-white shadow-xs">
                  🔒 REGISTRATION CLOSED
                </span>
              ) : fillPercentage >= 85 || eventStatus === 'few_seats' ? (
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

      {/* Operational Metric Cards (5 Cards Grid with Live Gate Admitted) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1.5">
          <span className="text-[11px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider block">Total Inquiries</span>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-black text-stone-900 block truncate">{totalInquiries}</span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
              {regularTotal} Public • {vipTotal} VIP
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-stone-400 font-medium block truncate">All couple entries received</span>
        </div>

        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1.5">
          <span className="text-[11px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider block">Approved Passes</span>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 block truncate">{approvedCount}</span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {regularApproved} Public • {vipApproved} VIP
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-700/80 font-medium block truncate">Confirmed &amp; active passes</span>
        </div>

        <div className="p-4 sm:p-5 bg-white border border-teal-200/90 rounded-2xl shadow-xs space-y-1.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-teal-800 font-bold uppercase tracking-wider block">Gate Admitted</span>
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-black text-teal-700 block truncate">{presentCount}</span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              {attendanceRate}% Present
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-teal-700/80 font-medium block truncate">
            {Math.max(0, approvedCount - presentCount)} couples awaiting arrival
          </span>
        </div>

        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1.5">
          <span className="text-[11px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider block">Pending Review</span>
          <span className="text-2xl sm:text-3xl font-black text-amber-600 block truncate">{pendingCount}</span>
          <span className="text-[10px] sm:text-[11px] text-amber-700/80 font-medium block truncate">Awaiting review or payment</span>
        </div>

        <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl shadow-xs space-y-1.5">
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
