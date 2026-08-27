'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminRole, AdminSection, Program } from '../../../types';
import { eventsApi } from '../../../services/admin/eventsApi';

interface AdminContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  password: string;
  setPassword: (val: string) => void;
  role: AdminRole;
  setRole: (role: AdminRole) => void;
  activeSection: AdminSection;
  setActiveSection: (sec: AdminSection) => void;
  selectedProgramId: string;
  setSelectedProgramId: (id: string) => void;
  programs: Program[];
  refreshPrograms: () => Promise<void>;
  loadingPrograms: boolean;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState<boolean>(false);
  const isFetchingRef = React.useRef(false);

  const refreshPrograms = async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoadingPrograms(true);
      const data = await eventsApi.getEvents();
      const list = data || [];
      setPrograms(list);

      // Default to the first confirmed active upcoming event (e.g. 7 September 2026 Surat)
      const confirmedUpcoming = list.filter(
        (p) =>
          (p.status === 'upcoming' || p.status === 'few_seats' || p.status === 'housefull') &&
          p.date !== 'TBD' &&
          Boolean(p.date && p.date >= '2026-09-01')
      );

      const firstConfirmed = confirmedUpcoming[0] || list.find((p) => p.status === 'upcoming');

      if (firstConfirmed) {
        setSelectedProgramId((prev) => (prev === 'all' || !list.some((p) => p.id === prev) ? firstConfirmed.id : prev));
      } else if (list.length > 0 && selectedProgramId === 'all') {
        setSelectedProgramId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch events in context:', err);
    } finally {
      setLoadingPrograms(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    refreshPrograms();
  }, []);

  const logout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('adminPassword');
      sessionStorage.removeItem('adminRole');
    }
    setPassword('');
    setIsAuthenticated(false);
    setRole('admin');
  };

  return (
    <AdminContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        password,
        setPassword,
        role,
        setRole,
        activeSection,
        setActiveSection,
        selectedProgramId,
        setSelectedProgramId,
        programs,
        refreshPrograms,
        loadingPrograms,
        logout
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
