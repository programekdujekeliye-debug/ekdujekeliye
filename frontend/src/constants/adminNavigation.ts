export type NormalAdminSection = 
  | 'dashboard'
  | 'programs'
  | 'registrations'
  | 'whatsapp'
  | 'settings';

export interface AdminNavItem {
  id: NormalAdminSection;
  label: string;
  gujaratiLabel?: string;
  iconName: string;
}

export const NORMAL_ADMIN_NAVIGATION: AdminNavItem[] = [
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
    id: 'whatsapp',
    label: 'WhatsApp Center',
    iconName: 'MessageCircleIcon'
  },
  {
    id: 'settings',
    label: 'Settings',
    iconName: 'SettingsIcon'
  }
];

export const ADMIN_NAVIGATION = NORMAL_ADMIN_NAVIGATION;
