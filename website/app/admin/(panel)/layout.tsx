import type { ReactNode } from 'react';
import Link from 'next/link';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Wordmark } from '@/components/Wordmark';
import { requireAdmin } from '@/lib/admin-auth';

// Every signed-in admin page: the session is checked here, and again in every
// server action, since a layout does not re-render on every action. The rail is
// the shadcn sidebar; below 900px it becomes a sheet behind the top bar's button.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AdminSidebar name={admin.name} email={admin.email} />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-rule bg-white px-4 md:hidden">
            <SidebarTrigger aria-label="Open the admin menu" />
            <Link href="/admin" className="text-lg no-underline" aria-label="Dr Quick admin, overview"><Wordmark /></Link>
          </header>
          <div className="mx-auto w-full max-w-[1280px] px-8 py-10 max-cols:px-4 max-cols:py-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
