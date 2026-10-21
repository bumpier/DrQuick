'use client';
import { PortalSidebar } from '@/components/app/PortalSidebar';
import { signOut } from '@/app/admin/actions';
import { ROLE_LABELS, type Role } from '@/lib/admin/roles';
import { navFor } from './nav';

// The admin's rail: every section in its group. The markup is shared with the
// doctor portal (components/app/PortalSidebar.tsx).
export function AdminSidebar({ name, email, role }: { name: string; email: string; role: Role }) {
  return (
    <PortalSidebar
      home="/admin"
      homeLabel="Dr Quick admin, overview"
      navLabel="Admin"
      groups={navFor(role)}
      name={name}
      email={email}
      detail={ROLE_LABELS[role]}
      signOut={signOut}
    />
  );
}
