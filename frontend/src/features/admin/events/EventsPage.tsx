'use client';

import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { eventsApi } from '../../../services/admin/eventsApi';
import { Program } from '../../../types';
import {
  MapPinIcon,
  CalendarIcon,
  UsersIcon,
  BuildingIcon,
  PencilIcon,
  TrashIcon,
  LayersIcon,
  CheckIcon,
  AlertTriangleIcon,
  XIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

type EventTab = 'general' | 'location' | 'pricing' | 'content' | 'speaker' | 'pass_seo';

export const EventsPage = () => {
  const { programs, refreshPrograms, loadingPrograms, role } = useAdmin();
  const isSuperAdmin = role === 'superadmin';

  // Active Tab in Create/Edit Modal
  const [activeTab, setActiveTab] = useState<EventTab>('general');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    shortName: '',
    slug: '',
    date: '',
    time: '8:30 PM',
    price: 1500,
    currency: 'INR',
    city: 'Surat',
    venue: '',
    venueAddress: '',
    mapUrl: '',
    description: '',
    headline: '',
    subheadline: '',
    instructions: '',
    heroImage: '',
    posterImage: '',
    contactPhone: '',
    contactWhatsapp: '',
    contactEmail: '',
    speakerName: 'Manish Vaghasiya',
    speakerTitle: 'Couple Relationship Counselor & Life Coach',
    speakerImage: '',
    speakerBio: '',
    ctaLabel: 'Book Couple Pass',
    passTitle: '',
    passInstructions: '',
    seoTitle: '',
    seoDescription: '',
    status: 'upcoming',
    registrationMode: 'internal',
    externalRegistrationUrl: '',
    capacity: 1000,
    isDateFinal: true,
    isInquiryClosed: false,
    heartX: 157,
    heartY: 91,
    heartWidth: 260,
    heartHeight: 312,
    photoZoom: 0.55,
    photoOffsetY: 0
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      shortName: '',
      slug: '',
      date: '',
      time: '8:30 PM',
      price: 1500,
      currency: 'INR',
      city: 'Surat',
      venue: '',
      venueAddress: '',
      mapUrl: '',
      description: '',
      headline: '',
      subheadline: '',
      instructions: '',
      heroImage: '',
      posterImage: '',
      contactPhone: '',
      contactWhatsapp: '',
      contactEmail: '',
      speakerName: 'Manish Vaghasiya',
      speakerTitle: 'Couple Relationship Counselor & Life Coach',
      speakerImage: '',
      speakerBio: '',
      ctaLabel: 'Book Couple Pass',
      passTitle: '',
      passInstructions: '',
      seoTitle: '',
      seoDescription: '',
      status: 'upcoming',
      registrationMode: 'internal',
      externalRegistrationUrl: '',
      capacity: 1000,
      isDateFinal: true,
      isInquiryClosed: false,
      heartX: 157,
      heartY: 91,
      heartWidth: 260,
      heartHeight: 312,
      photoZoom: 0.55,
      photoOffsetY: 0
    });
    setEditingProgram(null);
    setActiveTab('general');
    setError('');
    setSuccess('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleStartEdit = (prog: Program) => {
    setEditingProgram(prog);
    setFormData({
      ...prog,
      isDateFinal: prog.isDateFinal !== false,
      price: prog.price ?? 1500,
      capacity: prog.capacity || 1000
    });
    setActiveTab('general');
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const handleDuplicate = async (prog: Program) => {
    if (!confirm(`Duplicate "${prog.name}" to create a new event slot?`)) return;
    try {
      setDuplicatingId(prog.id);
      await eventsApi.duplicateEvent(prog.id);
      await refreshPrograms();
      toast.success(`Event "${prog.name}" duplicated successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate event.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete event "${name}"?`)) return;
    try {
      await eventsApi.deleteEvent(id);
      await refreshPrograms();
      toast.success(`Event "${name}" deleted.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || (formData.isDateFinal && !formData.date) || !formData.capacity) {
      toast.error('Please fill in required fields: Name, Date, and Capacity.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      if (editingProgram) {
        await eventsApi.updateEvent(editingProgram.id, formData);
        toast.success(`Event "${formData.name}" updated successfully.`);
      } else {
        await eventsApi.createEvent(formData);
        toast.success(`Event "${formData.name}" created successfully.`);
      }

      setIsModalOpen(false);
      resetForm();
      await refreshPrograms();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save event.');
    } finally {
      setSubmitting(false);
    }
  };

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'upcoming' | 'tbd' | 'completed'>('all');

  // Categorize programs
  const todayStr = new Date().toISOString().split('T')[0];
  const categorizedList = [...programs].sort((a, b) => {
    const isATbd = a.date === 'TBD' || a.date === 'TBA' || a.status === 'date_tba' || a.isDateFinal === false || !a.date;
    const isAComp = a.status === 'completed' || a.status === 'archived' || (a.date < todayStr && !isATbd);
    const rankA = isAComp ? 3 : isATbd ? 2 : 1;

    const isBTbd = b.date === 'TBD' || b.date === 'TBA' || b.status === 'date_tba' || b.isDateFinal === false || !b.date;
    const isBComp = b.status === 'completed' || b.status === 'archived' || (b.date < todayStr && !isBTbd);
    const rankB = isBComp ? 3 : isBTbd ? 2 : 1;

    if (rankA !== rankB) return rankA - rankB;
    if (rankA === 1) return (a.date || '').localeCompare(b.date || '') || (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
    if (rankA === 2) return (a.sequenceNumber || 0) - (b.sequenceNumber || 0) || (a.name || '').localeCompare(b.name || '');
    return (b.date || '').localeCompare(a.date || '') || (b.sequenceNumber || 0) - (a.sequenceNumber || 0);
  });

  const filteredPrograms = categorizedList.filter(p => {
    const isTbd = p.date === 'TBD' || p.date === 'TBA' || p.status === 'date_tba' || p.isDateFinal === false || !p.date;
    const isCompleted = p.status === 'completed' || p.status === 'archived' || (p.date < todayStr && !isTbd);
    const isUpcoming = !isCompleted && !isTbd;

    if (categoryFilter === 'upcoming') return isUpcoming;
    if (categoryFilter === 'tbd') return isTbd;
    if (categoryFilter === 'completed') return isCompleted;
    return true;
  });

  const upcomingCount = programs.filter(p => {
    const isTbd = p.date === 'TBD' || p.date === 'TBA' || p.status === 'date_tba' || p.isDateFinal === false || !p.date;
    const isCompleted = p.status === 'completed' || p.status === 'archived' || (p.date < todayStr && !isTbd);
    return !isCompleted && !isTbd;
  }).length;

  const tbdCount = programs.filter(p => p.date === 'TBD' || p.date === 'TBA' || p.status === 'date_tba' || p.isDateFinal === false || !p.date).length;
  const completedCount = programs.filter(p => p.status === 'completed' || p.status === 'archived' || (p.date < todayStr && p.date !== 'TBD' && p.date !== 'TBA')).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Event Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure live event schedules, dynamic pricing, venues, capacity, and media.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <span>+ Create New Event</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            categoryFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Slots ({programs.length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('upcoming')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
            categoryFilter === 'upcoming'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Upcoming Events ({upcomingCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('tbd')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            categoryFilter === 'tbd'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-sky-700 hover:bg-sky-50'
          }`}
        >
          Date TBA ({tbdCount})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('completed')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            categoryFilter === 'completed'
              ? 'bg-slate-600 text-white shadow-xs'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          Completed Seminars ({completedCount})
        </button>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Event Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPrograms.map((prog) => {
          const isTbd = prog.date === 'TBD' || prog.date === 'TBA' || prog.status === 'date_tba' || !prog.isDateFinal;
          const isCompleted = prog.status === 'completed' || prog.status === 'archived' || (prog.date < todayStr && !isTbd);
          const capacity = prog.capacity && prog.capacity > 0 ? prog.capacity : 1184;
          const approved = prog.approvedCount ?? prog.bookingsCount ?? 0;
          const pending = prog.pendingCount ?? 0;
          const rejected = prog.rejectedCount ?? 0;
          const totalBooked = approved + pending;
          const isHousefull = prog.isHousefull || approved >= capacity;
          const availableSlots = Math.max(0, capacity - approved);
          const fillPercentage = Math.min(100, Math.round((approved / capacity) * 100));

          return (
            <div
              key={prog.id}
              className={`bg-white border ${
                isHousefull
                  ? 'border-rose-300 bg-rose-50/10 ring-1 ring-rose-300/40'
                  : isCompleted
                  ? 'border-slate-200 bg-slate-50/60'
                  : 'border-slate-300 hover:border-rose-300'
              } rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between space-y-4`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-wider inline-block mb-1.5 bg-slate-100 text-slate-700 border-slate-200">
                      {prog.city || 'Gujarat'}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug break-words">
                      {prog.name}
                    </h3>
                  </div>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-lg border flex-shrink-0 whitespace-nowrap ${
                      isHousefull
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs animate-pulse'
                        : isCompleted
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : isTbd
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : prog.status === 'few_seats' || fillPercentage >= 85
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isHousefull
                      ? 'HOUSEFULL'
                      : isCompleted
                      ? 'COMPLETED'
                      : isTbd
                      ? 'Date TBA'
                      : prog.status === 'few_seats' || fillPercentage >= 85
                      ? 'FEW SEATS LEFT'
                      : 'UPCOMING'}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium">{isTbd ? 'Date to be announced' : `${prog.date} (${prog.time || '8:30 PM'})`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium truncate">{prog.venue || 'Venue to be announced'}</span>
                  </div>
                  
                  {/* Capacity & Booking Stats Box */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Capacity &amp; Bookings:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {approved} / {capacity} couples
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          fillPercentage >= 100
                            ? 'bg-rose-600'
                            : fillPercentage >= 85
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>

                    {/* Sub-counts breakdown */}
                    <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-slate-200/60 font-semibold">
                      <span className="text-emerald-700 font-bold">✓ Approved: {approved}</span>
                      <span className="text-amber-700 font-bold">⏳ Pending: {pending}</span>
                      <span className="text-slate-500">Available: {availableSlots}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-700 pt-0.5">
                    <span>Fee: ₹{prog.price ?? 1500} {prog.currency || 'INR'}</span>
                    <span className="text-[10px] text-slate-500 font-medium font-mono">
                      Total Inquiries: {totalBooked}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartEdit(prog)}
                  className="flex-1 px-3 py-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 hover:border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(prog)}
                  disabled={duplicatingId === prog.id}
                  title="Duplicate configuration to a new event slot"
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <LayersIcon className="w-3.5 h-3.5" />
                  <span>{duplicatingId === prog.id ? '...' : 'Duplicate'}</span>
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(prog.id, prog.name)}
                    title="Delete Event"
                    className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-700 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Structured Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingProgram ? `Edit Event: ${editingProgram.name}` : 'Create New Event Slot'}
                </h3>
                <p className="text-slate-500 text-xs">
                  All updates automatically propagate to Homepage, Pass, WhatsApp, and Payment gateways.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50/30 overflow-x-auto px-4 gap-2">
              {[
                { id: 'general', label: '1. General & Schedule' },
                { id: 'location', label: '2. Location & Capacity' },
                { id: 'pricing', label: '3. Pricing & Registration' },
                { id: 'content', label: '4. Media & Content' },
                { id: 'speaker', label: '5. Host & Speaker' },
                { id: 'pass_seo', label: '6. Pass & SEO' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as EventTab)}
                  className={`py-3 px-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                    activeTab === t.id
                      ? 'border-rose-600 text-rose-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body / Tab Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Tab 1: General & Schedule */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Event Title / Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Ek Duje Ke Liye - Jamnaba Bhavan"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Short Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.shortName || ''}
                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                        placeholder="e.g. Jamnaba 2026"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        URL Slug (Leave blank to auto-generate)
                      </label>
                      <input
                        type="text"
                        value={formData.slug || ''}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="e.g. surat-21-august-2026"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                      <select
                        value={formData.status || 'upcoming'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      >
                        <option value="upcoming">Upcoming (Open for Registrations)</option>
                        <option value="few_seats">Few Seats Left</option>
                        <option value="housefull">Housefull (Sold Out)</option>
                        <option value="registration_closed">Registration Closed</option>
                        <option value="date_tba">Date TBA Slot</option>
                        <option value="completed">Completed / Past</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Time</label>
                      <input
                        type="text"
                        value={formData.time || '8:30 PM'}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        placeholder="8:30 PM"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        id="isDateFinal"
                        checked={formData.isDateFinal}
                        onChange={(e) => setFormData({ ...formData, isDateFinal: e.target.checked })}
                        className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                      />
                      <label htmlFor="isDateFinal" className="text-xs font-bold text-slate-800 cursor-pointer">
                        Confirmed Event Date (Uncheck if Date is TBA / To Be Announced)
                      </label>
                    </div>
                    {formData.isDateFinal && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Event Date *</label>
                        <input
                          type="date"
                          required={formData.isDateFinal}
                          value={formData.date || ''}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Location & Capacity */}
              {activeTab === 'location' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                      <input
                        type="text"
                        required
                        value={formData.city || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. Surat"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Total Couple Capacity *
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.capacity || ''}
                        onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                        placeholder="e.g. 1000"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Venue Name</label>
                      <input
                        type="text"
                        value={formData.venue || ''}
                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                        placeholder="e.g. Jamnaba Bhavan, Varachha"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Full Venue Address</label>
                      <input
                        type="text"
                        value={formData.venueAddress || ''}
                        onChange={(e) => setFormData({ ...formData, venueAddress: e.target.value })}
                        placeholder="Detailed road, area, pincode..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Google Maps URL</label>
                      <input
                        type="url"
                        value={formData.mapUrl || ''}
                        onChange={(e) => setFormData({ ...formData, mapUrl: e.target.value })}
                        placeholder="https://maps.app.goo.gl/..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Pricing & Registration */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Registration Fee (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.price !== undefined ? formData.price : 1500}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        placeholder="1500"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                      <input
                        type="text"
                        value={formData.currency || 'INR'}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Registration Mode
                      </label>
                      <select
                        value={formData.registrationMode || 'internal'}
                        onChange={(e) => setFormData({ ...formData, registrationMode: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      >
                        <option value="internal">Internal (Direct Website Form &amp; Razorpay)</option>
                        <option value="external">External Redirect URL</option>
                      </select>
                    </div>
                    {formData.registrationMode === 'external' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">External Registration URL</label>
                        <input
                          type="url"
                          value={formData.externalRegistrationUrl || ''}
                          onChange={(e) => setFormData({ ...formData, externalRegistrationUrl: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        id="isInquiryClosed"
                        checked={formData.isInquiryClosed || false}
                        onChange={(e) => setFormData({ ...formData, isInquiryClosed: e.target.checked })}
                        className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                      />
                      <label htmlFor="isInquiryClosed" className="text-xs font-bold text-slate-800 cursor-pointer">
                        Temporarily Halt / Close Inquiries for this Event
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Media & Content */}
              {activeTab === 'content' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Hero Image URL</label>
                      <input
                        type="text"
                        value={formData.heroImage || ''}
                        onChange={(e) => setFormData({ ...formData, heroImage: e.target.value })}
                        placeholder="https://res.cloudinary.com/..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Poster Image URL</label>
                      <input
                        type="text"
                        value={formData.posterImage || ''}
                        onChange={(e) => setFormData({ ...formData, posterImage: e.target.value })}
                        placeholder="https://res.cloudinary.com/..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Headline (Optional)</label>
                      <input
                        type="text"
                        value={formData.headline || ''}
                        onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                        placeholder="A transformative relationship seminar for couples"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Event Description</label>
                      <textarea
                        rows={3}
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed summary of the program..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Host & Speaker */}
              {activeTab === 'speaker' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Speaker / Host Name</label>
                      <input
                        type="text"
                        value={formData.speakerName || ''}
                        onChange={(e) => setFormData({ ...formData, speakerName: e.target.value })}
                        placeholder="Manish Vaghasiya"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Speaker Title</label>
                      <input
                        type="text"
                        value={formData.speakerTitle || ''}
                        onChange={(e) => setFormData({ ...formData, speakerTitle: e.target.value })}
                        placeholder="Couple Relationship Counselor & Life Coach"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Support Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.contactPhone || ''}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        placeholder="+91 82003 02328"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Support WhatsApp</label>
                      <input
                        type="tel"
                        value={formData.contactWhatsapp || ''}
                        onChange={(e) => setFormData({ ...formData, contactWhatsapp: e.target.value })}
                        placeholder="+91 82003 02328"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 6: Pass & SEO */}
              {activeTab === 'pass_seo' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Pass Title Override</label>
                      <input
                        type="text"
                        value={formData.passTitle || ''}
                        onChange={(e) => setFormData({ ...formData, passTitle: e.target.value })}
                        placeholder="Leave blank for default pass header"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">SEO Title</label>
                      <input
                        type="text"
                        value={formData.seoTitle || ''}
                        onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                        placeholder="Ek Duje Ke Liye - Seminar in Surat"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Pass Instructions</label>
                      <textarea
                        rows={2}
                        value={formData.passInstructions || ''}
                        onChange={(e) => setFormData({ ...formData, passInstructions: e.target.value })}
                        placeholder="Special guidelines printed on digital pass..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingProgram ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
