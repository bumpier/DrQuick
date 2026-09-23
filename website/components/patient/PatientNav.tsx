import Link from 'next/link';
import { activeNav } from '@/lib/shell';
import { cn } from '@/lib/utils';
import { PATIENT_NAV, PATIENT_SECTION_OF } from './nav';

// One nav, two placements, decided by CSS so the server HTML is final: a row
// in the top bar from the phone line up, and below it the app's tab bar,
// fixed to the bottom edge (and lifted above the development jumper when it
// shows). The current destination is the primary mark: DESIGN.md gives active
// states the one accent.
export function PatientNav({ screen }: { screen: string }) {
  const current = activeNav(screen, PATIENT_SECTION_OF);
  return (
    <nav
      aria-label="Your account"
      data-slot="patient-nav"
      className={cn(
        'flex items-center gap-1',
        'max-phone:fixed max-phone:inset-x-0 max-phone:bottom-0 max-phone:z-20 max-phone:grid max-phone:h-(--nav-h) max-phone:grid-cols-4 max-phone:gap-0 max-phone:border-t max-phone:border-rule max-phone:bg-white',
        'group-data-[jumper=true]/surface:max-phone:bottom-(--jumper-h)',
      )}
    >
      {PATIENT_NAV.map(({ href, label, icon: Icon, screen: id }) => {
        const active = id === current;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-md px-3 text-label font-semibold whitespace-nowrap text-ink-2 no-underline',
              'transition-[background-color,color] duration-160 ease-(--ease) hover:bg-surface-mid hover:text-ink aria-[current=page]:text-primary',
              'max-phone:h-full max-phone:flex-col max-phone:justify-center max-phone:gap-1 max-phone:rounded-none max-phone:px-1 max-phone:text-[11px] max-phone:hover:bg-transparent',
            )}
          >
            <Icon strokeWidth={2} aria-hidden="true" className="size-5 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
