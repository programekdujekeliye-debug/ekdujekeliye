'use client';

import React, { useEffect } from 'react';
import { useAdmin } from '../../../features/admin/context/AdminContext';
import { NORMAL_ADMIN_NAVIGATION } from '../../../constants/adminNavigation';
import { SUPER_ADMIN_NAVIGATION } from '../../../constants/superAdminNavigation';
import {
  LayoutDashboardIcon,
  TicketIcon,
  UsersIcon,
  SettingsIcon,
  LogOutIcon,
  DollarSignIcon,
  MessageCircleIcon,
  ActivityIcon,
  ArchiveIcon,
  ShieldCheckIcon
} from '../../Icons';

interface AdminSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isSuperAdmin?: boolean;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboardIcon,
  TicketIcon,
  UsersIcon,
  DollarSignIcon,
  MessageCircleIcon,
  SettingsIcon,
  ActivityIcon,
  ArchiveIcon,
  ShieldCheckIcon
};

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  mobileOpen,
  setMobileOpen,
  isSuperAdmin = false
}) => {
  const { activeSection, setActiveSection, role, logout } = useAdmin();
  const navigationItems = isSuperAdmin ? SUPER_ADMIN_NAVIGATION : NORMAL_ADMIN_NAVIGATION;

  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between z-50 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 sm:p-5 space-y-5 flex flex-col h-full overflow-hidden">
          {/* Logo Brand & Mobile Close Button */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 md:border-none">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo.png" alt="Logo" className="h-8 sm:h-9 w-auto object-contain flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-extrabold text-slate-900 text-sm tracking-tight truncate">
                  {isSuperAdmin ? 'EDKL EventOS' : 'Ek Duje Ke Liye'}
                </h2>
                <span className={`text-[10px] font-extrabold tracking-wider uppercase block truncate ${isSuperAdmin ? 'text-purple-700' : 'text-rose-700'}`}>
                  {isSuperAdmin ? 'Super Admin' : 'Operations'}
                </span>
              </div>
            </div>

            {/* Close Button on Mobile Drawer */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Close Navigation Drawer"
            >
              <span className="text-base font-bold">✕</span>
            </button>
          </div>

          {/* Navigation Links with Guaranteed Single-Line Height */}
          <nav className="space-y-1 flex-grow overflow-y-auto pr-1">
            {navigationItems.map((item) => {
              const IconComp = iconMap[item.iconName] || LayoutDashboardIcon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as any);
                    setMobileOpen(false);
                  }}
                  title={item.label}
                  className={`w-full h-11 flex items-center gap-3 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-w-0 ${
                    isActive
                      ? isSuperAdmin
                        ? 'bg-purple-50 border border-purple-200 text-purple-900 shadow-xs'
                        : 'bg-rose-50 border border-rose-200 text-rose-800 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <IconComp className={`w-4 h-4 flex-shrink-0 ${isSuperAdmin ? (isActive ? 'text-purple-700' : 'text-purple-600') : (isActive ? 'text-rose-700' : 'text-rose-600')}`} />
                  <span className="truncate whitespace-nowrap text-left flex-1">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Active Role & Log Out */}
        <div className="p-4 sm:p-5 border-t border-slate-200 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                isSuperAdmin
                  ? 'bg-purple-100 border border-purple-300 text-purple-800'
                  : 'bg-rose-100 border border-rose-200 text-rose-700'
              }`}
            >
              {role === 'superadmin' ? 'SA' : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 capitalize truncate">
                {role === 'superadmin' ? 'Super Admin' : 'Event Admin'}
              </p>
              <span className="text-[10px] text-slate-500 font-medium block">Active Session</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full h-10 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs transition-all border border-red-200 flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
          >
            <LogOutIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="whitespace-nowrap">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden animate-fade-in transition-opacity"
          aria-hidden="true"
        />
      )}
    </>
  );
};
