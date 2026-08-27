'use client';

import React, { useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import { useAdmin } from '../context/AdminContext';
import { ShieldCheckIcon } from '../../../components/Icons';

export const AdminLogin = () => {
  const { setPassword, setIsAuthenticated, setRole, refreshPrograms } = useAdmin();
  const [inputPass, setInputPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPass) return;

    try {
      setLoading(true);
      setError('');
      const res = await apiClient<{ role: 'superadmin' | 'admin'; authenticated: boolean }>('/api/auth/verify', {
        authPassword: inputPass
      });

      if (res.authenticated) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('adminPassword', inputPass);
          sessionStorage.setItem('adminRole', res.role);
        }
        setPassword(inputPass);
        setRole(res.role);
        setIsAuthenticated(true);
        refreshPrograms();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid password. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mb-2">
            <ShieldCheckIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">EDKL EventOS</h1>
          <p className="text-xs text-slate-500 font-medium">Event Management Command Center</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Access Password
            </label>
            <input
              type="password"
              required
              value={inputPass}
              onChange={(e) => setInputPass(e.target.value)}
              placeholder="Enter administrator password..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-600/20 cursor-pointer transition-all active:scale-[0.99]"
          >
            {loading ? 'Authenticating...' : 'Sign In to Command Center'}
          </button>
        </form>

        <div className="text-center">
          <span className="text-[10px] text-slate-400 font-medium">
            Protected internal system &bull; Authorized personnel only
          </span>
        </div>
      </div>
    </div>
  );
};
