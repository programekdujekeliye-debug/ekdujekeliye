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
    iconName: 'AwardIcon'
  },
  {
    id: 'finance',
    label: 'Finance & Revenue',
    iconName: 'DollarSignIcon'
  },
  {
    id: 'feedback',
    label: 'Couples Feedback',
    gujaratiLabel: 'પ્રતિભાવ ડેશબોર્ડ',
    iconName: 'StarIcon'
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
    id: 'whatsapp_inbox',
    label: 'Support Inbox',
    iconName: 'MessageSquareIcon'
  },
  {
    id: 'whatsapp_broadcast',
    label: 'Broadcast Campaigns',
    gujaratiLabel: 'બ્રોડકાસ્ટ કેમ્પેઈન',
    iconName: 'SendIcon'
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
