'use client';
import { PortalSidebar } from '@/components/app/PortalSidebar';
import { signOut } from '@/app/admin/actions';
import { ADMIN_NAV } from './nav';

// The admin's rail: every section in its group. The markup is shared with the
// doctor portal (components/app/PortalSidebar.tsx).
export function AdminSidebar({ name, email }: { name: string; email: string }) {
  return (
    <PortalSidebar
      home="/admin"
      homeLabel="Dr Quick admin, overview"
      navLabel="Admin"
      groups={ADMIN_NAV}
      name={name}
      email={email}
      signOut={signOut}
    />
  );
}
