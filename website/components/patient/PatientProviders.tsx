'use client';

import type { ReactNode } from 'react';
import { DataModeProvider } from '@/lib/data-mode';
import { BookingProvider } from './BookingProvider';
import { PatientProvider } from './PatientProvider';

// Mounted by the patient layout alone, never the root layout: the landing
// page's bundle must not carry the booking, the fixtures or the toaster, and
// the patient surface must not be able to read another surface's state.
export function PatientProviders({ children }: { children: ReactNode }) {
  return (
    <DataModeProvider>
      <PatientProvider>
        <BookingProvider>{children}</BookingProvider>
      </PatientProvider>
    </DataModeProvider>
  );
}
