'use client';

import React, { useState, useEffect } from 'react';
import { AdminProvider, useAdmin } from '../admin/context/AdminContext';
import { AdminLogin } from '../admin/auth/AdminLogin';
import { AdminLayout } from '../../components/admin/layout/AdminLayout';
import { SuperAdminDashboard } from './dashboard/SuperAdminDashboard';
import { EventsPage } from '../admin/events/EventsPage';
import { RegistrationsPage } from '../admin/registrations/RegistrationsPage';
import { FinancePage } from '../admin/finance/FinancePage';
import { WhatsAppPage } from '../admin/whatsapp/WhatsAppPage';
import { SettingsPage } from '../admin/settings/SettingsPage';
import { ResourcesPage } from '../admin/resources/ResourcesPage';
import { IntegrationsPage } from '../admin/integrations/IntegrationsPage';
import { StoragePage } from './storage/StoragePage';
import { BatchExportModal } from '../admin/reports/BatchExportModal';
import { settingsApi } from '../../services/admin/settingsApi';
import { apiClient } from '../../services/apiClient';

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

  const handleClearAllData = async () => {
    if (!confirm('DANGER: Are you sure you want to completely wipe all submissions? This cannot be undone.')) {
      return;
    }
    const confirmText = prompt('Type DELETE to confirm complete database clear:');
    if (confirmText !== 'DELETE') {
      alert('Action cancelled.');
      return;
    }

    try {
      await settingsApi.clearAllData();
      alert('All submissions data cleared successfully.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to clear data.');
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
        Initializing Super Admin Command Center...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  // Strict Super Admin Access Guard
  if (role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 bg-red-950/50 border border-red-800 text-red-400 rounded-3xl max-w-md space-y-3">
          <span className="text-3xl">🚫</span>
          <h2 className="text-lg font-bold text-white">Access Denied</h2>
          <p className="text-xs text-red-300">
            Super Administrator privileges are required to access this portal. Your active account is limited to operational event management.
          </p>
          <div className="pt-2">
            <a
              href="/admin"
              className="inline-block px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Return to Event Operations (/admin)
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      isSuperAdmin={true}
      onExportClick={() => setShowExportModal(true)}
      onClearDataClick={handleClearAllData}
    >
      {/* Super Admin Privileged Views */}
      {activeSection === 'dashboard' && <SuperAdminDashboard />}
      {activeSection === 'programs' && <EventsPage />}
      {activeSection === 'registrations' && <RegistrationsPage />}
      {activeSection === 'finance' && <FinancePage />}
      {activeSection === 'storage' && <StoragePage />}
      {activeSection === 'whatsapp' && <WhatsAppPage />}
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
