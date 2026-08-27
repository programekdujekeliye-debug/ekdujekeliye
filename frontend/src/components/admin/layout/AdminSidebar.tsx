'use client';

import React from 'react';
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

  return (
    <>
      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-200 flex flex-col justify-between z-40 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 space-y-6 flex flex-col h-full overflow-hidden">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-9 w-auto object-contain" />
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm tracking-tight">
                {isSuperAdmin ? 'EDKL EventOS' : 'Ek Duje Ke Liye'}
              </h2>
              <span className={`text-[10px] font-bold tracking-wider uppercase ${isSuperAdmin ? 'text-purple-700' : 'text-rose-700'}`}>
                {isSuperAdmin ? 'Super Admin Center' : 'Event Operations'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 flex-grow overflow-y-auto pr-1">
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
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? isSuperAdmin
                        ? 'bg-purple-50 border border-purple-200 text-purple-900 shadow-xs'
                        : 'bg-rose-50 border border-rose-200 text-rose-800 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <IconComp className={`w-4 h-4 flex-shrink-0 ${isSuperAdmin ? 'text-purple-600' : 'text-rose-600'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Role & Log Out */}
        <div className="p-6 border-t border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                isSuperAdmin
                  ? 'bg-purple-100 border border-purple-300 text-purple-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {role === 'superadmin' ? 'SA' : 'A'}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 capitalize">
                {role === 'superadmin' ? 'Super Admin' : 'Event Admin'}
              </p>
              <span className="text-[9px] text-slate-500 font-medium">Active Session</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs transition-all border border-red-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOutIcon className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 md:hidden animate-fade-in"
        />
      )}
    </>
  );
};
