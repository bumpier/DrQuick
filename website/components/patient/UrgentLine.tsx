import { cn } from '@/lib/utils';

// The 999 route, in the landing page's .urgent grammar: body size, never fine
// print, a real tel: link, the one red mark the icon. Someone using this may
// need to tap it while shaking. The band variant is the landing sentence and
// sits on the home and account screens; the line is the short form every
// booking screen before the call carries.
export function UrgentLine({ variant = 'line', className }: { variant?: 'band' | 'line'; className?: string }) {
  return (
    <aside data-slot="urgent-line" className={cn('urgent', className)}>
      <p>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="7.6" stroke="currentColor" strokeWidth="2.1" />
          <path d="M9 5v4.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="9" cy="12.7" r="1.2" fill="currentColor" />
        </svg>
        {variant === 'band' ? (
          <span>
            Dr Quick is for urgent but non-emergency care. If something is serious or life-threatening,{' '}
            <b><a className="tel" href="tel:999">call 999</a> or go to A&amp;E.</b>
          </span>
        ) : (
          <span>
            If this is an emergency, <b><a className="tel" href="tel:999">call 999</a> or go to A&amp;E.</b>
          </span>
        )}
      </p>
    </aside>
  );
}
