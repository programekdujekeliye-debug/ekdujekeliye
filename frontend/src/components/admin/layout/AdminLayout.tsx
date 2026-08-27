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
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      {/* Sidebar Navigation */}
      <AdminSidebar
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Main Workspace Area */}
      <div className="flex-grow md:pl-64 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-30 sticky top-0 shadow-xs">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              {isSuperAdmin ? 'EventOS Super Admin' : 'EDKL Admin'}
            </span>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
          >
            {mobileSidebarOpen ? (
              <span className="text-xs font-bold px-1">✕</span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </header>

        {/* Content View Container */}
        <main className="p-6 md:p-8 space-y-8 flex-grow overflow-y-auto max-w-[1600px] mx-auto w-full">
          <AdminTopbar
            isSuperAdmin={isSuperAdmin}
            onExportClick={onExportClick}
            onClearDataClick={onClearDataClick}
          />
          {children}
        </main>
      </div>
    </div>
  );
};
