import { AdminSection } from '../types/admin';

export interface SuperAdminNavItem {
  id: AdminSection;
  label: string;
  gujaratiLabel?: string;
  iconName: string;
}

export const SUPER_ADMIN_NAVIGATION: SuperAdminNavItem[] = [
  {
    id: 'dashboard',
    label: 'Command Overview',
    iconName: 'LayoutDashboardIcon'
  },
  {
    id: 'programs',
    label: 'All Program Slots',
    iconName: 'TicketIcon'
  },
  {
    id: 'registrations',
    label: 'Global Registrations',
    iconName: 'UsersIcon'
  },
  {
    id: 'finance',
    label: 'Finance & Revenue',
    iconName: 'DollarSignIcon'
  },
  {
    id: 'storage',
    label: 'Storage & Archive',
    iconName: 'ArchiveIcon'
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Center',
    iconName: 'MessageCircleIcon'
  },
  {
    id: 'settings',
    label: 'Payment & Global Settings',
    iconName: 'SettingsIcon'
  },
  {
    id: 'resources',
    label: 'Resource Monitor',
    iconName: 'ActivityIcon'
  },
  {
    id: 'integrations',
    label: 'Integrations & Vendors',
    iconName: 'ShieldCheckIcon'
  }
];
