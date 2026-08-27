'use client';

import React from 'react';
import { useAdmin } from '../context/AdminContext';
import { FinanceOverview } from '../../../components/admin/FinanceOverview';

export const FinancePage = () => {
  const { password, selectedProgramId } = useAdmin();

  return (
    <div className="space-y-6">
      <FinanceOverview
        authPassword={password}
        selectedProgramId={selectedProgramId}
      />
    </div>
  );
};
