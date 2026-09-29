/* The admin's navigation: every section, grouped, in the order the sidebar
   shows them. Pages for some sections arrive in later phases; until then the
   link resolves to Next's not-found page. Which item is lit comes from the
   pathname (activeHref), longest matching prefix wins. */
import {
  BanknoteIcon, ChartLineIcon, ClipboardListIcon, CpuIcon, FileTextIcon, FilterIcon,
  HandCoinsIcon, LayoutDashboardIcon, MailIcon, MousePointerClickIcon, RadioIcon, ScrollTextIcon,
  SettingsIcon, StethoscopeIcon, TimerIcon, UserSearchIcon, UsersIcon, type LucideIcon,
} from 'lucide-react';

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  { label: 'Home', items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboardIcon }] },
  {
    label: 'Waitlist',
    items: [
      { href: '/admin/waitlist/patients', label: 'Patients', icon: UsersIcon },
      { href: '/admin/waitlist/gps', label: 'GPs', icon: StethoscopeIcon },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/admin/analytics/traffic', label: 'Traffic', icon: ChartLineIcon },
      { href: '/admin/analytics/engagement', label: 'Engagement', icon: TimerIcon },
      { href: '/admin/analytics/funnels', label: 'Funnels', icon: FilterIcon },
      { href: '/admin/analytics/heatmaps', label: 'Heatmaps', icon: MousePointerClickIcon },
      { href: '/admin/analytics/visitors', label: 'Visitors', icon: UserSearchIcon },
      { href: '/admin/analytics/live', label: 'Live', icon: RadioIcon },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/finance/revenue', label: 'Revenue', icon: BanknoteIcon },
      { href: '/admin/finance/consultations', label: 'Consultations', icon: ClipboardListIcon },
      { href: '/admin/finance/payouts', label: 'Payouts', icon: HandCoinsIcon },
    ],
  },
  { label: 'Content', items: [{ href: '/admin/blog', label: 'Blog', icon: FileTextIcon }] },
  {
    label: 'System',
    items: [
      { href: '/admin/system/technical', label: 'Technical', icon: CpuIcon },
      { href: '/admin/system/emails', label: 'Emails', icon: MailIcon },
      { href: '/admin/system/audit', label: 'Audit log', icon: ScrollTextIcon },
      { href: '/admin/system/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

// The item a pathname belongs to: /admin/waitlist/gps/123 lights GPs, and
// /admin lights Overview only when it is exactly /admin.
export function activeHref(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  let best: string | null = null;
  for (const { href } of ADMIN_NAV_ITEMS) {
    const hit = href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`);
    if (hit && (!best || href.length > best.length)) best = href;
  }
  return best;
}
