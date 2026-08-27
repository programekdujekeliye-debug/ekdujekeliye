'use client';

import React from 'react';
import { useAdmin } from '../context/AdminContext';
import { IntegrationsCenter } from '../../../components/admin/IntegrationsCenter';

export const IntegrationsPage = () => {
  const { password } = useAdmin();

  return (
    <div className="space-y-6">
      <IntegrationsCenter authPassword={password} />
    </div>
  );
};
