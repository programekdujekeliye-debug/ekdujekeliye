'use client';

import React, { useState, useEffect } from 'react';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { AdminLogin } from './auth/AdminLogin';
import { AdminLayout } from '../../components/admin/layout/AdminLayout';
import { DashboardPage } from './dashboard/DashboardPage';
import { EventsPage } from './events/EventsPage';
import { RegistrationsPage } from './registrations/RegistrationsPage';
import { WhatsAppPage } from './whatsapp/WhatsAppPage';
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
      const savedPass = typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : null;
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
          }
        } catch (_) {
          sessionStorage.removeItem('adminPassword');
          sessionStorage.removeItem('adminRole');
        }
      }
      setCheckingAuth(false);
    };

    checkSavedSession();
  }, []);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
        Initializing Event Operations...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <AdminLayout
      isSuperAdmin={false}
      onExportClick={() => setShowExportModal(true)}
    >
      {/* Normal Admin Operational Views Only (Zero Finance, Zero Resources, Zero Integrations) */}
      {activeSection === 'dashboard' && <DashboardPage />}
      {activeSection === 'programs' && <EventsPage />}
      {activeSection === 'registrations' && <RegistrationsPage />}
      {activeSection === 'whatsapp' && <WhatsAppPage />}
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
