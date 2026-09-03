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

/**
 * Computes India Standard Time date in YYYY-MM-DD format
 */
export const getIndiaTodayString = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

/**
 * Computes the primary default upcoming event based on strict business hierarchy:
 * 1. Nearest future dated event (date >= today in Asia/Kolkata, sorted date ASC, time ASC)
 * 2. Date TBA active operational event
 * 3. Most recent non-archived event
 * 4. Fallback: first event or null
 */
export const computeDefaultUpcomingEvent = (
  programs: Program[],
  allowedEventIds?: string[]
): Program | null => {
  let eligible = programs.filter(
    (p) => p.status !== 'archived' && p.status !== 'cancelled'
  );

  // Normal Admin assigned events constraint
  if (allowedEventIds && allowedEventIds.length > 0) {
    eligible = eligible.filter((p) => allowedEventIds.includes(p.id));
  }

  if (eligible.length === 0) return null;

  const todayStr = getIndiaTodayString();
  const operationalStatuses = new Set(['upcoming', 'few_seats', 'housefull', 'registration_open', 'published']);

  // 1. Future dated operational events
  const futureDated = eligible
    .filter(
      (p) =>
        Boolean(p.status && operationalStatuses.has(p.status)) &&
        p.date &&
        p.date !== 'TBD' &&
        p.status !== 'date_tba' &&
        p.isDateFinal !== false &&
        p.date >= todayStr
    )
    .sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '').localeCompare(b.time || '');
    });

  if (futureDated.length > 0) {
    return futureDated[0];
  }

  // 2. Date TBA operational event
  const tbaEvent = eligible.find(
    (p) =>
      Boolean(p.status && operationalStatuses.has(p.status)) &&
      (p.date === 'TBD' || p.status === 'date_tba' || p.isDateFinal === false)
  );

  if (tbaEvent) {
    return tbaEvent;
  }

  // 3. Most recent non-archived event
  const sortedRecent = [...eligible].sort((a, b) => {
    return (b.date || '').localeCompare(a.date || '');
  });

  return sortedRecent[0] || null;
};

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [selectedProgramId, setSelectedProgramIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('admin_selected_program_id');
      if (saved && saved !== 'all') return saved;
    }
    return '';
  });
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState<boolean>(false);
  const isFetchingRef = React.useRef(false);

  const setSelectedProgramId = (id: string) => {
    setSelectedProgramIdState(id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_selected_program_id', id);
    }
  };

  const refreshPrograms = async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoadingPrograms(true);
      const data = await eventsApi.getEventsSummary();
      const list = data || [];
      setPrograms(list);

      // Automatically default to the nearest upcoming active event
      const defaultEvent = computeDefaultUpcomingEvent(list);
      const savedId = typeof window !== 'undefined' ? sessionStorage.getItem('admin_selected_program_id') : null;

      // If a specific individual event was explicitly chosen, preserve it.
      // Otherwise (empty or 'all'), automatically focus on the upcoming event!
      if (savedId && savedId !== 'all' && list.some((p) => p.id === savedId || p.slug === savedId)) {
        setSelectedProgramIdState(savedId);
      } else if (defaultEvent) {
        setSelectedProgramIdState(defaultEvent.id);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_selected_program_id', defaultEvent.id);
        }
      } else if (list.length > 0) {
        setSelectedProgramIdState(list[0].id);
      } else {
        setSelectedProgramIdState('all');
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
      localStorage.removeItem('adminPassword');
      localStorage.removeItem('adminRole');
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
