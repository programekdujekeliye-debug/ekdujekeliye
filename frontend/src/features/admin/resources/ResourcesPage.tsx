'use client';

import React from 'react';
import { useAdmin } from '../context/AdminContext';
import { ResourceMonitor } from '../../../components/admin/ResourceMonitor';

export const ResourcesPage = () => {
  const { password } = useAdmin();

  return (
    <div className="space-y-6">
      <ResourceMonitor authPassword={password} />
    </div>
  );
};
