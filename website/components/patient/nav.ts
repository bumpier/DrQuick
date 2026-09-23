/* The patient surface's destinations, and the screen a pathname stands for.
   Its own file so the doctor and admin icons in components/app/nav.ts never
   enter the patient bundle; only the NavItem type is shared. */
import { HistoryIcon, HomeIcon, PillIcon, UserIcon } from 'lucide-react';
import type { NavItem } from '@/components/app/nav';

export const PATIENT_NAV: NavItem[] = [
  { href: '/patient', label: 'Home', icon: HomeIcon, screen: 'home' },
  { href: '/patient/consultations', label: 'Consultations', icon: HistoryIcon, screen: 'consultations' },
  { href: '/patient/prescriptions', label: 'Prescriptions', icon: PillIcon, screen: 'prescriptions' },
  { href: '/patient/account', label: 'Account', icon: UserIcon, screen: 'account' },
];

// Every screen that is not one of these is the booking flow, where the
// navigation steps aside: four destinations mid-request invite abandoning it.
export const PATIENT_DASH_SCREENS: readonly string[] = ['home', 'consultations', 'consultation-detail', 'prescriptions', 'account'];

// A consultation's detail belongs to the history, so that item stays lit.
export const PATIENT_SECTION_OF: Record<string, string> = { 'consultation-detail': 'consultations' };

export function patientScreenIdFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/patient') return 'home';
  if (path === '/patient/consultations') return 'consultations';
  if (path.startsWith('/patient/consultations/')) return 'consultation-detail';
  if (path === '/patient/prescriptions') return 'prescriptions';
  if (path === '/patient/account') return 'account';
  if (path === '/patient/book') return 'symptoms';
  if (path.startsWith('/patient/book/')) return path.slice('/patient/book/'.length);
  return path.slice(path.lastIndexOf('/') + 1);
}
