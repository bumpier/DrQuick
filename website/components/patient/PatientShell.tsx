'use client';

/* The patient surface's frame, and the first signed-in shell in the app. The
   ribbon and the top bar travel together as one sticky header (the ribbon
   wraps to two lines on a phone, so it cannot carry its own sticky offset);
   the jumper is last in the DOM and pads the frame while it shows. There is
   no sidebar: a patient has four destinations, not a console. */
import type { CSSProperties, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Arrival } from '@/components/app/Arrival';
import { Ribbon } from '@/components/app/Ribbon';
import { StateJumper } from '@/components/app/StateJumper';
import { Toaster } from '@/components/ui/sonner';
import { areaOf } from '@/lib/shell';
import { cn } from '@/lib/utils';
import { PATIENT_DASH_SCREENS, patientScreenIdFor } from './nav';
import { PatientTopBar } from './PatientTopBar';

// --header-h is the sticky header's height to the nearest rem at every width
// (the ribbon's second line on a phone is offset by the shorter top bar);
// the booking screens size to the space beneath it.
const SHELL_VARS = { '--header-h': '6rem', '--jumper-h': '2.75rem', '--nav-h': '4rem' } as CSSProperties;

export function PatientShell({ children }: { children: ReactNode }) {
  const screen = patientScreenIdFor(usePathname());
  const flow = areaOf(screen, PATIENT_DASH_SCREENS) === 'flow';
  return (
    <div
      data-surface="patient"
      data-area={flow ? 'flow' : 'dash'}
      style={SHELL_VARS}
      className="group/surface flex min-h-svh flex-col data-[jumper=true]:pb-(--jumper-h)"
    >
      <a className="skip" href="#main">Skip to content</a>
      <div className="sticky top-0 z-20">
        <Ribbon className="static" />
        <PatientTopBar screen={screen} flow={flow} />
      </div>
      <main id="main" tabIndex={-1} className={cn('flex flex-1 flex-col outline-none', !flow && 'max-phone:pb-(--nav-h)')}>
        {children}
      </main>
      <Arrival />
      <Toaster position="top-center" offset={{ top: '6.5rem' }} mobileOffset={{ top: '6.5rem' }} />
      <StateJumper surface="patient" />
    </div>
  );
}
