'use client';

import type { ReactNode } from 'react';
import { usePersistedQuery } from '@/lib/data-mode';

// Prototype chrome inside a screen, deliberately not the product: the state
// jumper's monospace on the band fill, shown under the jumper's own rule
// (development, or ?jumper=1) and nowhere else. It carries the shortcuts a
// reviewer needs and a patient never would: skip the wait, a declined card,
// nobody online.
export function ProtoNote({ children }: { children: ReactNode }) {
  const [jumper] = usePersistedQuery('jumper');
  if (process.env.NODE_ENV === 'production' && jumper !== '1') return null;
  return (
    <p data-slot="proto-note" className="flex flex-wrap items-center justify-center gap-2">
      {children}
    </p>
  );
}

export function ProtoAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-md bg-band px-2 py-1 font-mono text-[11px] text-white hover:bg-ink-2"
    >
      {children}
    </button>
  );
}
