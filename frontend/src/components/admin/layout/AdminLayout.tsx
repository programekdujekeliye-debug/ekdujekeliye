'use client';

import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

interface AdminLayoutProps {
  children: React.ReactNode;
  isSuperAdmin?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  isSuperAdmin = false
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      {/* Sidebar Navigation */}
      <AdminSidebar
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Main Workspace Area */}
      <div className="flex-grow md:pl-64 flex flex-col min-h-screen w-full min-w-0">
        {/* Test Environment Safety Banner */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-bold text-amber-900 tracking-wide flex items-center justify-center gap-2 z-20">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <span>TEST ENVIRONMENT — Isolated Database (No Real Payments)</span>
          </div>
        )}

        {/* Mobile Sticky Top Header */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center z-30 sticky top-0 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="Logo" className="h-7 w-auto object-contain flex-shrink-0" />
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-slate-900 text-xs tracking-tight block truncate">
                {isSuperAdmin ? 'EDKL EventOS' : 'Ek Duje Ke Liye'}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 border font-extrabold rounded-md uppercase tracking-wider flex-shrink-0 ${
                  isSuperAdmin
                    ? 'bg-purple-50 border-purple-200 text-purple-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Toggle Navigation Menu"
          >
            {mobileSidebarOpen ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </header>

        {/* Content View Container */}
        <main className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-6 flex-grow overflow-y-auto max-w-[1600px] mx-auto w-full min-w-0">
          <AdminTopbar isSuperAdmin={isSuperAdmin} />
          <div className="w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
