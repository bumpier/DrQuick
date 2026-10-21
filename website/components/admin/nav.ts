/* The admin's navigation: every section, grouped, in the order the sidebar
   shows them. Pages for some sections arrive in later phases; until then the
   link resolves to Next's not-found page. Which item is lit comes from the
   pathname (activeHref), longest matching prefix wins. */
import {
  BanknoteIcon, ChartLineIcon, ClipboardListIcon, CpuIcon, FileTextIcon, FilterIcon,
  HandCoinsIcon, LayoutDashboardIcon, MailIcon, MousePointerClickIcon, RadioIcon, ScrollTextIcon,
  SettingsIcon, StethoscopeIcon, TimerIcon, UserCogIcon, UserSearchIcon, UsersIcon, type LucideIcon,
} from 'lucide-react';

import { activeNavHref } from '@/components/app/nav';
import { can, type Area, type Role } from '@/lib/admin/roles';

export type AdminNavItem = { href: string; label: string; icon: LucideIcon; area: Area };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  { label: 'Home', items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboardIcon, area: 'overview' }] },
  {
    label: 'Waitlist',
    items: [
      { href: '/admin/waitlist/patients', label: 'Patients', icon: UsersIcon, area: 'waitlist' },
      { href: '/admin/waitlist/gps', label: 'GPs', icon: StethoscopeIcon, area: 'waitlist' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/admin/analytics/traffic', label: 'Traffic', icon: ChartLineIcon, area: 'analytics' },
      { href: '/admin/analytics/engagement', label: 'Engagement', icon: TimerIcon, area: 'analytics' },
      { href: '/admin/analytics/funnels', label: 'Funnels', icon: FilterIcon, area: 'analytics' },
      { href: '/admin/analytics/heatmaps', label: 'Heatmaps', icon: MousePointerClickIcon, area: 'analytics' },
      { href: '/admin/analytics/visitors', label: 'Visitors', icon: UserSearchIcon, area: 'analytics' },
      { href: '/admin/analytics/live', label: 'Live', icon: RadioIcon, area: 'analytics' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/finance/revenue', label: 'Revenue', icon: BanknoteIcon, area: 'finance' },
      { href: '/admin/finance/consultations', label: 'Consultations', icon: ClipboardListIcon, area: 'finance' },
      { href: '/admin/finance/payouts', label: 'Payouts', icon: HandCoinsIcon, area: 'finance' },
    ],
  },
  { label: 'Content', items: [{ href: '/admin/blog', label: 'Blog', icon: FileTextIcon, area: 'blog' }] },
  {
    label: 'System',
    items: [
      { href: '/admin/system/team', label: 'Team', icon: UserCogIcon, area: 'team' },
      { href: '/admin/system/technical', label: 'Technical', icon: CpuIcon, area: 'technical' },
      { href: '/admin/system/emails', label: 'Emails', icon: MailIcon, area: 'emails' },
      { href: '/admin/system/audit', label: 'Audit log', icon: ScrollTextIcon, area: 'audit' },
      { href: '/admin/system/settings', label: 'Settings', icon: SettingsIcon, area: 'settings' },
    ],
  },
];

// The groups a role can reach, without the ones left empty.
export function navFor(role: Role): AdminNavGroup[] {
  return ADMIN_NAV
    .map((g) => ({ ...g, items: g.items.filter((item) => can(role, item.area)) }))
    .filter((g) => g.items.length > 0);
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

// The item a pathname belongs to: /admin/waitlist/gps/123 lights GPs, and
// /admin lights Overview only when it is exactly /admin.
export function activeHref(pathname: string): string | null {
  return activeNavHref(pathname, ADMIN_NAV_ITEMS.map((item) => item.href), '/admin');
}
