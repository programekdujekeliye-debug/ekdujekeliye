'use client';

import React, { useState, useEffect } from 'react';
import { settingsApi } from '../../../services/admin/settingsApi';
import { ManualInviteeModal } from './ManualInviteeModal';

export const SettingsPage = () => {
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState<number>(1500);
  const [upiIds, setUpiIds] = useState('');
  const [upiLimit, setUpiLimit] = useState<number>(50);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      if (data) {
        setUpiId(data.upiId || '');
        setPayeeName(data.payeeName || '');
        setAmount(data.amount || 1500);
        setUpiIds(data.upiIds || data.upiId || '');
        setUpiLimit(data.upiLimit || 50);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiId || !payeeName || !amount) {
      setError('All fields are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      await settingsApi.updateSettings({
        upiId,
        payeeName,
        amount,
        upiIds,
        upiLimit
      });
      setSuccess('Payment settings updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Payment Settings Card */}
      <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>💳</span>
            <span>Payment &amp; UPI Rotation Settings</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Configure active UPI account details, limits, and rotating payee IDs for QR codes.
          </p>
        </div>

        {error && <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">{error}</div>}
        {success && <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold">{success}</div>}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                UPI ID List (Comma separated for Rotation)
              </label>
              <input
                type="text"
                required
                value={upiIds}
                onChange={(e) => {
                  setUpiIds(e.target.value);
                  const first = e.target.value.split(',')[0]?.trim();
                  if (first) setUpiId(first);
                }}
                placeholder="upi1@okaxis, upi2@okicici"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Currently Active UPI ID
              </label>
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="payee@upi"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rotation Limit (Submissions / UPI)
              </label>
              <input
                type="number"
                required
                min="1"
                value={upiLimit}
                onChange={(e) => setUpiLimit(Number(e.target.value))}
                placeholder="50"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Payee Account Name
              </label>
              <input
                type="text"
                required
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="e.g. EK DUJE KE LIYE"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Default Ticket Amount (₹)
              </label>
              <input
                type="number"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
          >
            {submitting ? 'Saving Settings...' : 'Save Payment Settings'}
          </button>
        </form>
      </div>

      {/* VIP Invitee Registration Component */}
      <ManualInviteeModal />
    </div>
  );
};
