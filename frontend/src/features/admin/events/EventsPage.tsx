'use client';

import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { eventsApi } from '../../../services/admin/eventsApi';
import { Program } from '../../../types';

export const EventsPage = () => {
  const { programs, refreshPrograms, loadingPrograms } = useAdmin();

  // Create Form State
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('8:30 PM');
  const [price, setPrice] = useState<number | ''>(1500);
  const [city, setCity] = useState('Surat');
  const [venue, setVenue] = useState('Sardar Patel Smruti Bhavan, Varachha, Surat');
  const [mapUrl, setMapUrl] = useState('https://share.google/y1jtFAZXuKusYTiUD');
  const [status, setStatus] = useState('upcoming');
  const [slug, setSlug] = useState('');
  const [registrationMode, setRegistrationMode] = useState<'internal' | 'external'>('internal');
  const [externalUrl, setExternalUrl] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [isDateFinal, setIsDateFinal] = useState(true);
  const [isInquiryClosed, setIsInquiryClosed] = useState(false);
  const [photoLink, setPhotoLink] = useState('');
  const [cardTemplate, setCardTemplate] = useState<string | null>(null);

  // Edit State
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('8:30 PM');
  const [editPrice, setEditPrice] = useState<number | ''>(1500);
  const [editCity, setEditCity] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editMapUrl, setEditMapUrl] = useState('');
  const [editStatus, setEditStatus] = useState('upcoming');
  const [editSlug, setEditSlug] = useState('');
  const [editRegistrationMode, setEditRegistrationMode] = useState<'internal' | 'external'>('internal');
  const [editExternalUrl, setEditExternalUrl] = useState('');
  const [editCapacity, setEditCapacity] = useState<number | ''>('');
  const [editIsDateFinal, setEditIsDateFinal] = useState(true);
  const [editIsInquiryClosed, setEditIsInquiryClosed] = useState(false);
  const [editPhotoLink, setEditPhotoLink] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (isDateFinal && !date) || !capacity) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      await eventsApi.createEvent({
        name,
        date,
        time,
        price: price ? Number(price) : 1500,
        city,
        venue,
        mapUrl,
        status,
        slug,
        registrationMode,
        externalRegistrationUrl: externalUrl,
        capacity: Number(capacity),
        isDateFinal,
        isInquiryClosed,
        photoLink,
        cardTemplate
      });

      setSuccess('Program slot created successfully.');
      setName('');
      setDate('');
      setCapacity('');
      refreshPrograms();
    } catch (err: any) {
      setError(err.message || 'Failed to create program slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (prog: Program) => {
    setEditingProgram(prog);
    setEditName(prog.name);
    setEditDate(prog.date);
    setEditTime(prog.time || '8:30 PM');
    setEditPrice(prog.price ?? 1500);
    setEditCity(prog.city || '');
    setEditVenue(prog.venue || '');
    setEditMapUrl(prog.mapUrl || '');
    setEditStatus(prog.status || 'upcoming');
    setEditSlug(prog.slug || '');
    setEditRegistrationMode((prog.registrationMode as any) || 'internal');
    setEditExternalUrl(prog.externalRegistrationUrl || '');
    setEditCapacity(prog.capacity);
    setEditIsDateFinal(prog.isDateFinal !== false);
    setEditIsInquiryClosed(prog.isInquiryClosed || false);
    setEditPhotoLink(prog.photoLink || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram) return;

    try {
      setSubmitting(true);
      await eventsApi.updateEvent(editingProgram.id, {
        name: editName,
        date: editDate,
        time: editTime,
        price: editPrice ? Number(editPrice) : 1500,
        city: editCity,
        venue: editVenue,
        mapUrl: editMapUrl,
        status: editStatus,
        slug: editSlug,
        registrationMode: editRegistrationMode,
        externalRegistrationUrl: editExternalUrl,
        capacity: Number(editCapacity),
        isDateFinal: editIsDateFinal,
        isInquiryClosed: editIsInquiryClosed,
        photoLink: editPhotoLink
      });

      setEditingProgram(null);
      refreshPrograms();
    } catch (err: any) {
      alert(err.message || 'Failed to update program.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this program?')) return;
    try {
      await eventsApi.deleteEvent(id);
      refreshPrograms();
    } catch (err: any) {
      alert(err.message || 'Failed to delete program.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create / Edit Program Form */}
      <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {editingProgram ? 'Edit Program Slot' : 'Add Program Slot'}
          </h2>
          <p className="text-slate-500 text-[11px] sm:text-xs mt-1 font-medium">
            Schedule an event with a specific date, pricing, venue, and seat capacity.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold">
            {success}
          </div>
        )}

        <form onSubmit={editingProgram ? handleUpdate : handleCreate} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Program Name
            </label>
            <input
              type="text"
              required
              value={editingProgram ? editName : name}
              onChange={(e) => (editingProgram ? setEditName(e.target.value) : setName(e.target.value))}
              placeholder="e.g. Ek Duje Ke Liye - Surat"
              className="w-full px-3 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Program Date
              </label>
              <input
                type="date"
                required={editingProgram ? editIsDateFinal : isDateFinal}
                value={editingProgram ? editDate : date}
                onChange={(e) => (editingProgram ? setEditDate(e.target.value) : setDate(e.target.value))}
                className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Event Time
              </label>
              <input
                type="text"
                value={editingProgram ? editTime : time}
                onChange={(e) => (editingProgram ? setEditTime(e.target.value) : setTime(e.target.value))}
                placeholder="e.g. 8:30 PM"
                className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Couple Pass Price (₹)
              </label>
              <input
                type="number"
                min="0"
                required
                value={editingProgram ? editPrice : price}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  editingProgram ? setEditPrice(val) : setPrice(val);
                }}
                className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                City
              </label>
              <input
                type="text"
                value={editingProgram ? editCity : city}
                onChange={(e) => (editingProgram ? setEditCity(e.target.value) : setCity(e.target.value))}
                placeholder="Surat"
                className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Venue &amp; Address
            </label>
            <input
              type="text"
              value={editingProgram ? editVenue : venue}
              onChange={(e) => (editingProgram ? setEditVenue(e.target.value) : setVenue(e.target.value))}
              placeholder="e.g. Sardar Patel Smruti Bhavan, Varachha, Surat"
              className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={editingProgram ? editStatus : status}
                onChange={(e) => (editingProgram ? setEditStatus(e.target.value) : setStatus(e.target.value))}
                className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
              >
                <option value="upcoming">Upcoming (Active)</option>
                <option value="few_seats">Few Seats Left</option>
                <option value="housefull">Housefull / Sold Out</option>
                <option value="registration_closed">Registration Closed</option>
                <option value="completed">Completed / Past</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Registration Mode
              </label>
              <select
                value={editingProgram ? editRegistrationMode : registrationMode}
                onChange={(e) => {
                  const val = e.target.value as 'internal' | 'external';
                  editingProgram ? setEditRegistrationMode(val) : setRegistrationMode(val);
                }}
                className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
              >
                <option value="internal">Internal (Website &amp; Razorpay)</option>
                <option value="external">External Link</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Hall Capacity (Seats, e.g. 600 for 300 Couples)
            </label>
            <input
              type="number"
              required
              min="1"
              value={editingProgram ? editCapacity : capacity}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                editingProgram ? setEditCapacity(val) : setCapacity(val);
              }}
              placeholder="e.g. 600"
              className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 min-h-[42px] bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              {submitting ? 'Saving...' : editingProgram ? 'Update Program' : 'Create Program Slot'}
            </button>
            {editingProgram && (
              <button
                type="button"
                onClick={() => setEditingProgram(null)}
                className="px-4 py-2.5 min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Program Slots List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Active Program Slots</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Overview of current seminars and capacity limits.
              </p>
            </div>
            <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold rounded-full">
              {programs.length} Slots
            </span>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {loadingPrograms && programs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-medium text-xs">Loading program slots...</div>
            ) : programs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-medium text-xs">No program slots scheduled.</div>
            ) : (
              programs.map((prog) => {
                const remainingSeats = prog.capacity - (prog.bookingsCount || 0);
                const isSoldOut = remainingSeats < 2;

                return (
                  <div
                    key={prog.id}
                    className="p-4 sm:p-5 border border-slate-200 rounded-2xl hover:border-slate-300 transition-all bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-2 min-w-0 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{prog.name}</h3>
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-bold">
                          ₹{prog.price ?? 1500}
                        </span>
                        {prog.city && (
                          <span className="px-2 py-0.5 text-[10px] bg-blue-50 border border-blue-200 text-blue-800 rounded-full font-semibold">
                            📍 {prog.city}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                            isSoldOut
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isSoldOut ? 'Sold Out' : 'Active'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-3 sm:gap-4 flex-wrap">
                        <span>
                          📅 <strong>{prog.date}</strong>
                        </span>
                        <span>
                          👥 Booked:{' '}
                          <strong className={isSoldOut ? 'text-red-600' : 'text-rose-700'}>
                            {Math.floor((prog.bookingsCount || 0) / 2)}
                          </strong>{' '}
                          / {Math.floor(prog.capacity / 2)} couples
                        </span>
                        {prog.venue && (
                          <span className="text-slate-500 truncate max-w-full">
                            🏛️ {prog.venue}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      <button
                        onClick={() => handleStartEdit(prog)}
                        className="px-3 py-1.5 min-h-[36px] bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-all border border-amber-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(prog.id)}
                        className="px-3 py-1.5 min-h-[36px] bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all border border-red-200 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
