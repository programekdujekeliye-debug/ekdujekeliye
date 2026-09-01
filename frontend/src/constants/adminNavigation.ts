export type NormalAdminSection = 
  | 'dashboard'
  | 'scanner'
  | 'programs'
  | 'registrations'
  | 'vip_passes'
  | 'whatsapp'
  | 'whatsapp_inbox'
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
    id: 'scanner',
    label: 'Gate Scanner',
    iconName: 'CameraIcon'
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
    id: 'vip_passes',
    label: 'VIP Passes',
    iconName: 'SparklesIcon'
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Center',
    iconName: 'MessageCircleIcon'
  },
  {
    id: 'whatsapp_inbox',
    label: 'Support Inbox',
    iconName: 'MessageSquareIcon'
  },
  {
    id: 'settings',
    label: 'Settings',
    iconName: 'SettingsIcon'
  }
];

export const ADMIN_NAVIGATION = NORMAL_ADMIN_NAVIGATION;
