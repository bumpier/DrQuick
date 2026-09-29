import Link from 'next/link';
import { FlaskConicalIcon } from 'lucide-react';
import { DemoBadge } from '@/components/admin/DemoBadge';
import { withQuery, type Query } from '@/lib/admin/url';
import { cn } from '@/lib/utils';

// The finance pages' "Preview with demo data" switch: ?demo=1 in the URL, so
// a preview can be shared and never sticks. A link, not a form.
export function DemoToggle({ basePath, query, demo }: { basePath: string; query: Query; demo: boolean }) {
  return (
    <Link
      href={withQuery(basePath, query, { demo: demo ? null : '1', page: null })}
      aria-pressed={demo}
      className={cn(
        'inline-flex h-12 items-center gap-2 rounded-pill px-5 font-semibold no-underline',
        demo ? 'bg-ink text-white hover:bg-primary-ink' : 'bg-white text-ink ring-2 ring-ink ring-inset hover:bg-surface-mid',
      )}
    >
      <FlaskConicalIcon strokeWidth={2} className="size-5" aria-hidden="true" />
      {demo ? 'Show real data' : 'Preview with demo data'}
    </Link>
  );
}

// Said once at the top of any page showing the generator's numbers.
export function DemoBanner() {
  return (
    <div role="note" data-slot="demo-banner" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-stone px-5 py-4">
      <DemoBadge />
      <p className="text-body text-ink">
        Invented figures for previewing this page: a generated year of trading, not real money and not a forecast.
      </p>
    </div>
  );
}

// A card or section title with the demo badge beside it when it applies.
export function Titled({ title, demo, className }: { title: string; demo: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      {title}
      {demo && <DemoBadge />}
    </span>
  );
}

export const NOT_LIVE = 'Payments aren’t live yet — this fills in once consultations are taken.';
