'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '../../../services/apiClient';
import { useAdmin } from '../context/AdminContext';
import { ShieldCheckIcon, AlertTriangleIcon } from '../../../components/Icons';

export const AdminLogin = () => {
  const { setPassword, setIsAuthenticated, setRole, refreshPrograms } = useAdmin();
  const [inputPass, setInputPass] = useState('');
  const [showPass, setShowPass] = useState(false);
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
      setError(err.message || 'Invalid administrator password. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Subtle Luxury Glows */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-rose-200/40 via-amber-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-t from-rose-100/30 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Branding */}
      <header className="w-full max-w-md pt-4 sm:pt-6 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-8 sm:h-9 w-auto object-contain" />
          <span className="font-extrabold text-slate-900 text-sm tracking-tight hidden sm:inline">
            Ek Duje Ke Liye
          </span>
        </Link>
        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 tracking-wider">
          Management Portal
        </span>
      </header>

      {/* Central Login Card */}
      <main className="max-w-md w-full my-auto z-10 py-6">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-900/5 space-y-6">
          {/* Brand & Heading */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 shadow-xs mb-1">
              <ShieldCheckIcon className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              EDKL EventOS
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Event Management &amp; Financial Command Center
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
              <AlertTriangleIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  Admin Access Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="text-[11px] font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoFocus
                  value={inputPass}
                  onChange={(e) => setInputPass(e.target.value)}
                  placeholder="Enter administrator password..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-2xl text-slate-900 text-base font-mono outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !inputPass.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-rose-600/20 cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating Session...</span>
                </>
              ) : (
                <span>Sign In to Command Center</span>
              )}
            </button>
          </form>

          {/* Security Subtext */}
          <div className="pt-2 border-t border-slate-100 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-semibold">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Protected internal system &bull; Authorized personnel only</span>
            </div>
            <Link
              href="/"
              className="inline-block text-xs font-bold text-slate-500 hover:text-rose-700 transition-colors"
            >
              ← Return to Public Website
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md pb-4 text-center text-[11px] text-slate-400 font-medium z-10">
        &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; Manish Vaghasiya
      </footer>
    </div>
  );
};
