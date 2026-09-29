import Link from 'next/link';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { fmtCount } from '@/lib/admin/format';
import { withQuery, type Query } from '@/lib/admin/url';
import { cn } from '@/lib/utils';

/* The server-side table pieces. The list's state — search, filters, sort,
   page — is all in the URL, so these are links and render on the server; only
   the search box and the filter selects (ListToolbar) need the browser. */

// A column header that sorts. Clicking the current column flips the direction;
// a new column starts at the direction that reads best (newest, A–Z).
export function SortHeader({ label, column, basePath, query, defaultDir = 'asc', className }: {
  label: string;
  column: string;
  basePath: string;
  query: Query;
  defaultDir?: 'asc' | 'desc';
  className?: string;
}) {
  const current = (query.sort ?? 'joined') === column;
  const dir = query.dir === 'asc' ? 'asc' : 'desc';
  const next = current ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir;
  const Icon = !current ? ArrowUpDownIcon : dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <TableHead className={className} aria-sort={current ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link
        href={withQuery(basePath, query, { sort: column, dir: next, page: null })}
        className={cn('inline-flex items-center gap-1 no-underline hover:text-ink', current ? 'text-ink' : 'text-ink-2')}
      >
        {label}
        <Icon strokeWidth={2} className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{current ? `, sorted ${dir === 'asc' ? 'ascending' : 'descending'}` : ', sort'}</span>
      </Link>
    </TableHead>
  );
}

export function Pagination({ page, pages, total, pageSize, basePath, query, noun }: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  basePath: string;
  query: Query;
  noun: [string, string];
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const link = 'inline-flex h-10 items-center gap-1 rounded-pill px-4 text-fine font-semibold no-underline';
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-fine text-ink-2">
        {total === 0 ? `No ${noun[1]}` : `Showing ${fmtCount(first)}–${fmtCount(last)} of ${fmtCount(total)} ${total === 1 ? noun[0] : noun[1]}`}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={withQuery(basePath, query, { page: page === 2 ? null : String(page - 1) })} className={cn(link, 'bg-white text-ink shadow-card hover:bg-surface-mid')}>
              <ChevronLeftIcon strokeWidth={2} className="size-4" aria-hidden="true" /> Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(link, 'text-outline')}><ChevronLeftIcon strokeWidth={2} className="size-4" aria-hidden="true" /> Previous</span>
          )}
          <span className="text-fine text-ink-2 tabular-nums">Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={withQuery(basePath, query, { page: String(page + 1) })} className={cn(link, 'bg-white text-ink shadow-card hover:bg-surface-mid')}>
              Next <ChevronRightIcon strokeWidth={2} className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(link, 'text-outline')}>Next <ChevronRightIcon strokeWidth={2} className="size-4" aria-hidden="true" /></span>
          )}
        </div>
      )}
    </nav>
  );
}
