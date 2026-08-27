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

  const refreshPrograms = async () => {
    try {
      setLoadingPrograms(true);
      const data = await eventsApi.getEvents();
      setPrograms(data || []);
    } catch (err) {
      console.error('Failed to fetch events in context:', err);
    } finally {
      setLoadingPrograms(false);
    }
  };

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
