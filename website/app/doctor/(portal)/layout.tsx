import type { ReactNode } from 'react';
import Link from 'next/link';
import { DoctorSidebar } from '@/components/doctor/DoctorSidebar';
import { OfferNotice, ShiftProvider } from '@/components/doctor/ShiftProvider';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Wordmark } from '@/components/Wordmark';
import { getDb } from '@/lib/db';
import { requireDoctor } from '@/lib/doctor-auth';
import { shiftState, type ShiftState } from '@/lib/doctor/shift';

// Every signed-in portal page: the session is checked here, and again in every
// page and server action, since a layout does not re-render on every action.
// The shift lives here too, so an offer reaches the doctor on any page.
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const doctor = await requireDoctor();
  const db = await getDb();
  const initial: ShiftState = db ? await shiftState(db, doctor.id) : { kind: 'offline' };
  return (
    <TooltipProvider>
      <SidebarProvider>
        <DoctorSidebar name={doctor.name} email={doctor.email} />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-rule bg-white px-4 md:hidden">
            <SidebarTrigger aria-label="Open the menu" />
            <Link href="/doctor" className="text-lg no-underline" aria-label="Dr Quick doctor portal, dashboard"><Wordmark /></Link>
          </header>
          <div className="mx-auto w-full max-w-[1080px] px-8 py-10 max-cols:px-4 max-cols:py-6">
            <ShiftProvider initial={initial}>
              <OfferNotice />
              {children}
            </ShiftProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
