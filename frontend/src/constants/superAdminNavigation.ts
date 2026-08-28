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
    label: 'Overview',
    iconName: 'LayoutDashboardIcon'
  },
  {
    id: 'programs',
    label: 'Event Slots',
    iconName: 'TicketIcon'
  },
  {
    id: 'registrations',
    label: 'Registrations',
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
    label: 'Global Settings',
    iconName: 'SettingsIcon'
  },
  {
    id: 'resources',
    label: 'System Resources',
    iconName: 'ActivityIcon'
  },
  {
    id: 'integrations',
    label: 'Integrations',
    iconName: 'ShieldCheckIcon'
  }
];
