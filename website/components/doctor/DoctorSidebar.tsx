'use client';
import { PortalSidebar, type PortalNavGroup } from '@/components/app/PortalSidebar';
import { DOCTOR_NAV } from '@/components/app/nav';
import { signOut } from '@/app/doctor/actions';

const GROUPS: PortalNavGroup[] = [{ label: null, items: DOCTOR_NAV }];

// The doctor portal's rail: Dashboard, Earnings, Profile.
export function DoctorSidebar({ name, email }: { name: string; email: string }) {
  return (
    <PortalSidebar
      home="/doctor"
      homeLabel="Dr Quick doctor portal, dashboard"
      navLabel="Doctor portal"
      groups={GROUPS}
      name={name}
      email={email}
      signOut={signOut}
    />
  );
}
