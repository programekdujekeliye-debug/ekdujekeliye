'use client';

import React, { useState, useEffect } from 'react';
import { AdminProvider, useAdmin } from '../admin/context/AdminContext';
import { AdminLogin } from '../admin/auth/AdminLogin';
import { AdminLayout } from '../../components/admin/layout/AdminLayout';
import { SuperAdminDashboard } from './dashboard/SuperAdminDashboard';
import { ScannerPage } from '../admin/scanner/ScannerPage';
import { EventsPage } from '../admin/events/EventsPage';
import { RegistrationsPage } from '../admin/registrations/RegistrationsPage';
import { VipPassesPage } from '../admin/vip/VipPassesPage';
import { FinancePage } from '../admin/finance/FinancePage';
import { WhatsAppPage } from '../admin/whatsapp/WhatsAppPage';
import { WhatsAppInboxPage } from '../admin/whatsapp/WhatsAppInboxPage';
import { SettingsPage } from '../admin/settings/SettingsPage';
import { ResourcesPage } from '../admin/resources/ResourcesPage';
import { IntegrationsPage } from '../admin/integrations/IntegrationsPage';
import { StoragePage } from './storage/StoragePage';
import { BatchExportModal } from '../admin/reports/BatchExportModal';
import { settingsApi } from '../../services/admin/settingsApi';
import { apiClient } from '../../services/apiClient';
import toast from 'react-hot-toast';

const SuperAdminAppContent = () => {
  const {
    isAuthenticated,
    setIsAuthenticated,
    setPassword,
    role,
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

  const handleClearAllData = async () => {
    if (!confirm('DANGER: Are you sure you want to completely wipe all submissions? This cannot be undone.')) {
      return;
    }
    const confirmText = prompt('Type DELETE to confirm complete database clear:');
    if (confirmText !== 'DELETE') {
      toast('Action cancelled.', { icon: 'ℹ️' });
    } else {
      try {
        await settingsApi.clearAllData();
        toast.success('All submissions data cleared successfully.');
        window.location.reload();
      } catch (err: any) {
        toast.error(err.message || 'Failed to clear data.');
      }
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center gap-3 text-slate-800 text-xs font-bold">
        <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <span>Initializing Super Admin Command Center...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  // Strict Super Admin Access Guard
  if (role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-6 bg-white border border-red-200 text-slate-800 rounded-3xl max-w-md shadow-xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Access Denied</h2>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Super Administrator privileges are required to access this portal. Your active account is limited to operational event management.
          </p>
          <div className="pt-2">
            <a
              href="/admin"
              className="inline-block px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Return to Event Operations (/admin)
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout isSuperAdmin={true}>
      {/* Super Admin Privileged Views */}
      {activeSection === 'dashboard' && <SuperAdminDashboard />}
      {activeSection === 'scanner' && <ScannerPage />}
      {activeSection === 'programs' && <EventsPage />}
      {activeSection === 'registrations' && <RegistrationsPage />}
      {activeSection === 'vip_passes' && <VipPassesPage />}
      {activeSection === 'finance' && <FinancePage />}
      {activeSection === 'storage' && <StoragePage />}
      {activeSection === 'whatsapp' && <WhatsAppPage />}
      {activeSection === 'whatsapp_inbox' && <WhatsAppInboxPage />}
      {activeSection === 'settings' && <SettingsPage />}
      {activeSection === 'resources' && <ResourcesPage />}
      {activeSection === 'integrations' && <IntegrationsPage />}

      {/* Global Batch Export Modal */}
      <BatchExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </AdminLayout>
  );
};

export const SuperAdminApp = () => {
  return (
    <AdminProvider>
      <SuperAdminAppContent />
    </AdminProvider>
  );
};
