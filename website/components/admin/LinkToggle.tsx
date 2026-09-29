import type { ReactNode } from 'react';
import Link from 'next/link';
import { segmentedLinkGroupVariants, segmentedLinkVariants } from '@/components/ui/segmented-link';
import { cn } from '@/lib/utils';

// A small segmented control whose options are links (the view's state is in
// the URL), styled as the shared segmented-link. Next's Link keeps the admin a
// client navigation; without JavaScript each option is still a real link.
export function LinkToggle({ label, options, className }: {
  label: string;
  options: Array<{ href: string; label: string; current: boolean }>;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} data-slot="link-toggle" className={cn(segmentedLinkGroupVariants({ size: 'sm' }), 'w-fit', className)}>
      {options.map((o) => (
        <Link
          key={o.href + o.label}
          href={o.href}
          aria-current={o.current ? 'true' : undefined}
          className={segmentedLinkVariants({ size: 'sm' })}
          scroll={false}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

// A labelled control in the filter row above a page's charts.
export function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-fine font-semibold text-ink-2">{label}</span>
      {children}
    </div>
  );
}
