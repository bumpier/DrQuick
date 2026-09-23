import type { ReactNode } from 'react';

// The one h1 on a route, at DESIGN.md's headline-lg — the base h1 scale is the
// landing hero's and is far too large inside the shell. It carries data-reveal
// (a route's first arrival, decision 13) and tabIndex -1 so a screen that must
// move focus on arrival — the offer — can hand it to the heading, as the landing
// hero does on a mode switch. The actions do not reveal: only the h1 and a
// route's first tile row do.
export function PageHeader({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <div data-slot="page-header" className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 max-phone:mb-6">
      <div className="min-w-0">
        <h1 data-reveal tabIndex={-1} className="text-headline max-phone:text-headline-sm">{title}</h1>
        {lead && <p className="mt-2 max-w-[52ch] text-body text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
