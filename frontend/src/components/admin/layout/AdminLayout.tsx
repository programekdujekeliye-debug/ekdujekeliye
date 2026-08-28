'use client';

import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

interface AdminLayoutProps {
  children: React.ReactNode;
  isSuperAdmin?: boolean;
  onExportClick?: () => void;
  onClearDataClick?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  isSuperAdmin = false,
  onExportClick,
  onClearDataClick
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
        {/* Mobile Sticky Top Header */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center z-30 sticky top-0 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="Logo" className="h-7 w-auto object-contain flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-extrabold text-slate-900 text-xs tracking-tight block truncate">
                {isSuperAdmin ? 'EventOS Super Admin' : 'EDKL Admin'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle Navigation Menu"
          >
            {mobileSidebarOpen ? (
              <span className="text-sm font-bold">✕</span>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </header>

        {/* Content View Container */}
        <main className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-6 flex-grow overflow-y-auto max-w-[1600px] mx-auto w-full min-w-0">
          <AdminTopbar
            isSuperAdmin={isSuperAdmin}
            onExportClick={onExportClick}
            onClearDataClick={onClearDataClick}
          />
          <div className="w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
