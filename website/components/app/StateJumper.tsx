'use client';
/* The prototype rail's replacement: a development tool, deliberately not the
   product — band-filled, monospace, pinned to the bottom, last in the DOM. Every
   item is a full page load, which is also how a gate or a data mode is chosen. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useDataMode, usePersistedQuery } from '@/lib/data-mode';
import { ADMIN_JUMPS, DOCTOR_JUMPS, PATIENT_JUMPS, isCurrentJump, jumpHref, type JumpLocation } from './jumps';

const GROUPS = { doctor: DOCTOR_JUMPS, admin: ADMIN_JUMPS, patient: PATIENT_JUMPS } as const;

export function StateJumper({ surface }: { surface: 'doctor' | 'admin' | 'patient' }) {
  const pathname = usePathname();
  const { mode } = useDataMode();
  const [jumper] = usePersistedQuery('jumper');
  const show = process.env.NODE_ENV !== 'production' || jumper === '1';
  const ref = useRef<HTMLElement>(null);

  // The URL is read after the commit's effects, not during them: the providers
  // re-stamp their query keys in their own effects, which run after this
  // descendant's, so a same-tick read would miss ?data=seeded after a navigation.
  // Null on the server and the first client render, so the HTML never differs.
  const [loc, setLoc] = useState<JumpLocation | null>(null);
  useEffect(() => {
    if (!show) return;
    const id = window.setTimeout(
      () => setLoc({ pathname: window.location.pathname, search: window.location.search }), 0);
    return () => window.clearTimeout(id);
  }, [show, pathname, mode, jumper]);

  // The shell pads its bottom edge by --jumper-h while the jumper is there, so
  // Accept and Decline never sit under it at 390.
  useEffect(() => {
    const shell = ref.current?.closest<HTMLElement>('[data-surface]');
    if (!shell) return;
    shell.dataset.jumper = 'true';
    return () => { delete shell.dataset.jumper; };
  }, [show]);

  if (!show) return null;
  const groups = GROUPS[surface];
  return (
    <nav
      ref={ref}
      aria-label="Prototype navigation"
      data-slot="state-jumper"
      className="fixed inset-x-0 bottom-0 z-30 flex h-11 items-center gap-2 overflow-x-auto border-t border-white/20 bg-band px-3 font-mono text-[11px] text-white"
    >
      {groups.map((group) => (
        <div key={group.label} className="flex shrink-0 items-center gap-2">
          <span className="uppercase tracking-[.06em] text-band-ink-2">{group.label}</span>
          {group.items.map((item) => {
            const current = loc !== null && isCurrentJump(item.href, loc);
            return (
              <a
                key={item.href}
                href={loc ? jumpHref(item.href, loc) : item.href}
                data-kind={item.kind}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-md border border-white/20 px-2 py-1 whitespace-nowrap no-underline hover:bg-white/15',
                  item.kind === 'state' && 'border-dashed',
                  current && 'bg-white text-ink hover:bg-white',
                )}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
