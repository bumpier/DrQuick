import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Pagination } from '@/components/admin/DataTable';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtDuration } from '@/lib/admin/analytics-labels';
import { ago, firstTouchChannel, fmtCount, fmtDate, hostOf } from '@/lib/admin/format';
import { listVisitors, parseVisitorQuery, type VisitorSort } from '@/lib/admin/queries/visitors';
import { flatParams, withQuery, type Query } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Visitors' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/analytics/visitors';

// The shared SortHeader defaults to the waitlist's 'joined'; this list's default is 'last'.
function Sort({ label, column, query, className }: { label: string; column: VisitorSort; query: Query; className?: string }) {
  const current = (query.sort ?? 'last') === column;
  const dir = query.dir === 'asc' ? 'asc' : 'desc';
  const next = current ? (dir === 'asc' ? 'desc' : 'asc') : 'desc';
  const Icon = !current ? ArrowUpDownIcon : dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <TableHead className={className} aria-sort={current ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link href={withQuery(BASE, query, { sort: column === 'last' ? null : column, dir: next === 'desc' ? null : next, page: null })}
        className={cn('inline-flex items-center gap-1 no-underline hover:text-ink', current ? 'text-ink' : 'text-ink-2')}>
        {label}
        <Icon strokeWidth={2} className="size-3.5" aria-hidden="true" />
      </Link>
    </TableHead>
  );
}

export default async function VisitorsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const query = flatParams(params);
  const q = parseVisitorQuery(params);
  const header = <AdminPageHeader title="Visitors" description="Everyone who accepted analytics, with their visits. Open one to see their whole journey." />;
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const result = await listVisitors(db, q);
  const ownHost = hostOf(siteUrl().toString());
  const filtered = Boolean(q.q || q.signed);
  const now = new Date();

  return (
    <>
      {header}
      <ListToolbar
        basePath={BASE}
        query={query}
        placeholder="Search by sign-up email"
        filters={[{ name: 'signed', label: 'Signed up', options: [{ value: 'yes', label: 'Signed up' }, { value: 'no', label: 'Not signed up' }] }]}
      />
      <Card className="block px-4 py-3 max-phone:px-2">
        {result.total === 0 ? (
          <EmptyState className="my-2">
            {filtered ? 'No visitors match these filters.' : 'No visitors yet. People who accept analytics on the site appear here.'}
          </EmptyState>
        ) : (
          <Table stack="cols">
            <TableHeader>
              <TableRow>
                <TableHead>Visitor</TableHead>
                <Sort label="First seen" column="first" query={query} />
                <Sort label="Last seen" column="last" query={query} />
                <Sort label="Visits" column="sessions" query={query} className="text-right" />
                <Sort label="Pages" column="pageviews" query={query} className="text-right" />
                <Sort label="Engaged" column="engaged" query={query} className="text-right" />
                <TableHead>First came from</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell data-label="Visitor" className="max-w-[18rem]">
                    <Link href={`${BASE}/${v.id}`} className="block truncate font-semibold text-primary-ink">
                      {v.signup ? v.signup.email : <span className="font-mono">{v.id.slice(0, 8)}</span>}
                    </Link>
                    {v.signup && <Badge variant="success" className="mt-1">{v.signup.role === 'gp' ? 'GP sign-up' : 'Patient sign-up'}</Badge>}
                  </TableCell>
                  <TableCell data-label="First seen">{fmtDate(v.firstSeen)}</TableCell>
                  <TableCell data-label="Last seen">{ago(v.lastSeen, now)}</TableCell>
                  <TableCell data-label="Visits" className="text-right tabular-nums">{fmtCount(v.sessions)}</TableCell>
                  <TableCell data-label="Pages" className="text-right tabular-nums">{fmtCount(v.pageviews)}</TableCell>
                  <TableCell data-label="Engaged" className="text-right tabular-nums">{fmtDuration(v.engagedSeconds)}</TableCell>
                  <TableCell data-label="Came from">{firstTouchChannel({ utmSource: v.firstUtmSource, referrer: v.firstReferrer }, ownHost)}</TableCell>
                  <TableCell data-label="Device" className="capitalize">{v.device ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={q.pageSize}
        basePath={BASE} query={query} noun={['visitor', 'visitors']} />
    </>
  );
}
