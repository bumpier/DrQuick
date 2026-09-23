/* The product nav of each surface, and the screen a pathname stands for. The
   preview's router knew screens by hash; here the pathname is the screen, and
   the rail, the top bar and the collapse decision all read this one map. */
import {
  ActivityIcon, BanknoteIcon, ChartColumnIcon, LayoutDashboardIcon, ShieldCheckIcon, UserIcon, UsersIcon,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; screen: string };

export const DOCTOR_NAV: NavItem[] = [
  { href: '/doctor', label: 'Dashboard', icon: LayoutDashboardIcon, screen: 'dashboard' },
  { href: '/doctor/earnings', label: 'Earnings', icon: BanknoteIcon, screen: 'earnings' },
  { href: '/doctor/profile', label: 'Profile', icon: UserIcon, screen: 'profile' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Live floor', icon: ActivityIcon, screen: 'floor' },
  { href: '/admin/governance', label: 'Governance', icon: ShieldCheckIcon, screen: 'governance' },
  { href: '/admin/supply', label: 'GP supply', icon: UsersIcon, screen: 'supply' },
  { href: '/admin/business', label: 'Business', icon: ChartColumnIcon, screen: 'business' },
];

// Decision 15: every session and onboarding route is a flow, so the rail collapses there.
export const DOCTOR_DASH_SCREENS: readonly string[] = ['dashboard', 'earnings', 'profile'];
export const ADMIN_DASH_SCREENS: readonly string[] = ['floor', 'governance', 'supply', 'business'];

// The availability screens belong to the dashboard, so its item stays lit in the
// collapsed rail and its tooltip.
export const DOCTOR_SECTION_OF: Record<string, string> = {
  offline: 'dashboard', 'online-idle': 'dashboard', 'no-patients-waiting': 'dashboard',
};

export function screenIdFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/doctor') return 'dashboard';
  if (path === '/admin') return 'floor';
  if (path === '/doctor/session') return 'offline';
  if (path === '/doctor/onboarding') return 'register';
  return path.slice(path.lastIndexOf('/') + 1);
}
