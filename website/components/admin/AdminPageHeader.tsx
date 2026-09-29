import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';

// The admin page's title row: the one h1, a one-line description, and the
// page's actions on the right. No reveal animation: the admin is a tool.
export function AdminPageHeader({ title, description, actions, back }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div data-slot="admin-page-header" className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-fine font-semibold text-primary-ink no-underline hover:underline">
            <ChevronLeftIcon strokeWidth={2} className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="text-headline break-words max-phone:text-headline-sm">{title}</h1>
        {description && <p className="mt-1 max-w-[62ch] text-body text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

// What an admin page shows when the server has no database to read.
export function NoDatabase() {
  return (
    <div role="alert" className="rounded-xl bg-white p-6 shadow-card">
      <h2 className="text-xl font-bold">Database not configured</h2>
      <p className="mt-1 text-body text-ink-2">
        This server has no DATABASE_URL, so there is nothing to show. Set it in the environment and restart.
      </p>
    </div>
  );
}
