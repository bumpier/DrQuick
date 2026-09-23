import type { ReactNode } from 'react';
import { renderAt, nav, type RenderAtOptions } from './render-at';
import { PatientProviders } from '@/components/patient/PatientProviders';
import { PatientShell } from '@/components/patient/PatientShell';
import { BookingFlow } from '@/components/patient/BookingFlow';
import type { BookingScreen } from '@/lib/booking-flow';

type Options = Omit<RenderAtOptions, 'pathname' | 'providers'> & { pathname?: string; shell?: boolean };

// Render a patient screen the way the layout mounts it: the data mode, the
// patient store and the booking reducer, optionally inside the shell. The
// files that use this mock 'next/navigation' (./next-navigation) and
// 'next/link' (./next-link) themselves, because vi.mock is hoisted per file.
export function renderPatient(ui: ReactNode, { pathname = '/patient', shell = false, ...rest }: Options = {}) {
  const Providers = ({ children }: { children: ReactNode }) => (
    <PatientProviders>{shell ? <PatientShell>{children}</PatientShell> : children}</PatientProviders>
  );
  return renderAt(ui, { pathname, providers: Providers, ...rest });
}

// A booking screen landed on by URL, as a reviewer or the state jumper would.
export function renderBooking(screen: BookingScreen, options: Omit<Options, 'pathname'> = {}) {
  return renderPatient(<BookingFlow />, { pathname: `/patient/book/${screen}`, ...options });
}

export { nav };
