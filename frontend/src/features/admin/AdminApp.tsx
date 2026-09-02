'use client';

import React, { useState, useEffect } from 'react';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { AdminLogin } from './auth/AdminLogin';
import { AdminLayout } from '../../components/admin/layout/AdminLayout';
import { DashboardPage } from './dashboard/DashboardPage';
import { ScannerPage } from './scanner/ScannerPage';
import { EventsPage } from './events/EventsPage';
import { RegistrationsPage } from './registrations/RegistrationsPage';
import { WhatsAppPage } from './whatsapp/WhatsAppPage';
import { WhatsAppInboxPage } from './whatsapp/WhatsAppInboxPage';
import { VipPassesPage } from './vip/VipPassesPage';
import { SettingsPage } from './settings/SettingsPage';
import { BatchExportModal } from './reports/BatchExportModal';
import { apiClient } from '../../services/apiClient';

const NormalAdminAppContent = () => {
  const {
    isAuthenticated,
    setIsAuthenticated,
    setPassword,
    setRole,
    activeSection,
    refreshPrograms
  } = useAdmin();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    const checkSavedSession = async () => {
      const savedPass = typeof window !== 'undefined'
        ? (sessionStorage.getItem('adminPassword') || localStorage.getItem('adminPassword'))
        : null;
      if (savedPass) {
        try {
          const res = await apiClient<{ role: 'superadmin' | 'admin'; authenticated: boolean }>(
            '/api/auth/verify',
            { authPassword: savedPass }
          );
          if (res.authenticated) {
            setPassword(savedPass);
            setRole(res.role);
            setIsAuthenticated(true);
            sessionStorage.setItem('adminPassword', savedPass);
            sessionStorage.setItem('adminRole', res.role);
          }
        } catch (_) {
          sessionStorage.removeItem('adminPassword');
          sessionStorage.removeItem('adminRole');
          localStorage.removeItem('adminPassword');
          localStorage.removeItem('adminRole');
        }
      }
      setCheckingAuth(false);
    };

    checkSavedSession();
  }, []);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center gap-3 text-slate-800 text-xs font-bold">
        <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
        <span>Initializing Event Operations...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <AdminLayout isSuperAdmin={false}>
      {/* Normal Admin Operational Views Only */}
      {activeSection === 'dashboard' && <DashboardPage />}
      {activeSection === 'scanner' && <ScannerPage />}
      {activeSection === 'programs' && <EventsPage />}
      {activeSection === 'registrations' && <RegistrationsPage />}
      {activeSection === 'vip_passes' && <VipPassesPage />}
      {activeSection === 'whatsapp' && <WhatsAppPage />}
      {activeSection === 'whatsapp_inbox' && <WhatsAppInboxPage />}
      {activeSection === 'settings' && <SettingsPage />}

      {/* Export Modal */}
      <BatchExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </AdminLayout>
  );
};

export const AdminApp = () => {
  return (
    <AdminProvider>
      <NormalAdminAppContent />
    </AdminProvider>
  );
};
