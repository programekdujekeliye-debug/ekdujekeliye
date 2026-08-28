'use client';

import React from 'react';
import { AdminProvider } from '../../../features/admin/context/AdminContext';
import { ScannerPage } from '../../../features/admin/scanner/ScannerPage';
import { AdminLayout } from '../../../components/admin/layout/AdminLayout';

export default function AdminScannerRoute() {
  return (
    <AdminProvider>
      <AdminLayout isSuperAdmin={false}>
        <ScannerPage />
      </AdminLayout>
    </AdminProvider>
  );
}
