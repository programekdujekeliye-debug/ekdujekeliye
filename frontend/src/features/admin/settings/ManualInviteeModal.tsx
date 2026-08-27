'use client';

import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { API_BASE_URL } from '../../../config';

export const ManualInviteeModal = () => {
  const { programs, password } = useAdmin();

  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [programId, setProgramId] = useState('');
  const [couplePhoto, setCouplePhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedPassUrl, setGeneratedPassUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!husbandName || !wifeName || !surname || !phoneNumber || !programId) {
      setError('All fields are required.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setGeneratedPassUrl('');

      const formData = new FormData();
      formData.append('husbandName', husbandName);
      formData.append('wifeName', wifeName);
      formData.append('surname', surname);
      formData.append('phoneNumber', phoneNumber);
      formData.append('programId', programId);
      if (couplePhoto) formData.append('couplePhoto', couplePhoto);

      const activePassword = password || sessionStorage.getItem('adminPassword') || '';
      const res = await fetch(`${API_BASE_URL}/api/submissions/manual`, {
        method: 'POST',
        headers: { Authorization: activePassword.startsWith('Bearer ') ? activePassword : `Bearer ${activePassword}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess('Guest registered successfully!');
        const passLink = `${window.location.origin}/pass/${data.data.inquiryId}`;
        setGeneratedPassUrl(passLink);
        setHusbandName('');
        setWifeName('');
        setSurname('');
        setPhoneNumber('');
        setCouplePhoto(null);
      } else {
        setError(data.error || 'Failed to register invitee.');
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting manual registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <span>✍️</span>
          <span>Manual Invitee Registration (VIP Passes)</span>
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Directly register invited guests, automatically generating an instant approved pass with prefix IP-.
        </p>
      </div>

      {error && <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">{error}</div>}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs space-y-2">
          <span className="font-bold block">{success}</span>
          {generatedPassUrl && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-emerald-200">
              <span className="font-mono text-xs text-emerald-900 select-all break-all">{generatedPassUrl}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassUrl);
                    alert('Pass link copied to clipboard!');
                  }}
                  className="px-3 py-1.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-900 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Copy Link
                </button>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hello! Your special pass is ready. Download it here: ${generatedPassUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Share on WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Husband Name</label>
            <input
              type="text"
              required
              value={husbandName}
              onChange={(e) => setHusbandName(e.target.value)}
              placeholder="Husband's name"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Wife Name</label>
            <input
              type="text"
              required
              value={wifeName}
              onChange={(e) => setWifeName(e.target.value)}
              placeholder="Wife's name"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Surname</label>
            <input
              type="text"
              required
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Surname"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Mobile Number</label>
            <input
              type="tel"
              required
              pattern="[6-9][0-9]{9}"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit number"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Program Slot</label>
            <select
              required
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-semibold focus:bg-white focus:outline-none focus:border-rose-500"
            >
              <option value="">-- Choose Slot --</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.date})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Couple Photo (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && setCouplePhoto(e.target.files[0])}
              className="w-full text-slate-600 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
        >
          {loading ? 'Creating Pass...' : 'Register VIP Guest'}
        </button>
      </form>
    </div>
  );
};
