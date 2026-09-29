import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadIcon, KanbanIcon, TableIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Pagination, SortHeader } from '@/components/admin/DataTable';
import { ErasedNotice } from '@/components/admin/ErasedNotice';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Card } from '@/components/ui/card';
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtCount, fmtDate, sourceLabel, statusLabel } from '@/lib/admin/format';
import { gpBoard, listSignups, parseListQuery, sourcesFor, statusesFor } from '@/lib/admin/queries/waitlist';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb, type DB } from '@/lib/db';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'GPs' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/waitlist/gps';

export default async function GpsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const query = flatParams(params);
  const view = query.view === 'table' ? 'table' : 'board';
  const db = await getDb();

  const header = (
    <AdminPageHeader
      title="GPs"
      description="GP applications, from first contact to active. Open one to check their GMC number and move them on."
      actions={db && (
        <a href={withQuery('/admin/waitlist/export', { ...query, role: 'gp', view: undefined, page: undefined, notice: undefined })} download
          className="inline-flex h-12 items-center gap-2 rounded-pill bg-white px-5 font-semibold text-ink no-underline ring-2 ring-ink ring-inset hover:bg-surface-mid">
          <DownloadIcon strokeWidth={2} className="size-5" aria-hidden="true" />
          Download CSV
        </a>
      )}
    />
  );
  if (!db) return <>{header}<NoDatabase /></>;

  const switcher = (
    <SegmentedLinkGroup size="sm" aria-label="View" className="mb-4 w-fit">
      <SegmentedLink size="sm" href={withQuery(BASE, {}, {})} current={view === 'board'} className="gap-1.5">
        <KanbanIcon strokeWidth={2} className="size-4" aria-hidden="true" />Pipeline
      </SegmentedLink>
      <SegmentedLink size="sm" href={withQuery(BASE, {}, { view: 'table' })} current={view === 'table'} className="gap-1.5">
        <TableIcon strokeWidth={2} className="size-4" aria-hidden="true" />Table
      </SegmentedLink>
    </SegmentedLinkGroup>
  );

  return (
    <>
      {header}
      {query.notice === 'erased' && <ErasedNotice />}
      {switcher}
      {view === 'board' ? <Board db={db} /> : <GpTable db={db} params={params} query={query} />}
    </>
  );
}

async function Board({ db }: { db: DB }) {
  const columns = await gpBoard(db);
  const total = columns.reduce((n, c) => n + c.cards.length, 0);
  if (total === 0) {
    return <Card variant="quiet" className="block p-6"><EmptyState className="border-none">No GP applications yet. Applications from the GP page appear here.</EmptyState></Card>;
  }
  return (
    <div
      className="grid auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 max-phone:grid-flow-row max-phone:grid-cols-1"
      aria-label="GP pipeline"
      role="list"
    >
      {columns.map((col) => (
        <section
          key={col.status}
          role="listitem"
          aria-label={`${statusLabel('gp', col.status)}, ${col.cards.length}`}
          className={cn('flex min-w-0 flex-col rounded-xl p-3', col.status === 'active' ? 'bg-lime-wash' : col.status === 'rejected' ? 'bg-stone' : 'bg-surface-mid')}
        >
          <h2 className="mb-3 flex items-center justify-between px-1 text-body font-bold">
            {statusLabel('gp', col.status)}
            <span className="rounded-pill bg-white px-2 text-fine font-bold tabular-nums">{fmtCount(col.cards.length)}</span>
          </h2>
          {col.cards.length === 0 ? (
            <p className="px-1 pb-2 text-fine text-ink-2">None</p>
          ) : (
            <ul className="grid gap-2">
              {col.cards.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/waitlist/gps/${c.id}`} className="block rounded-lg bg-white p-3 no-underline shadow-card transition-colors duration-160 ease-(--ease) hover:bg-surface">
                    <span className="block truncate font-semibold text-ink">{c.name || c.email}</span>
                    <span className="mt-0.5 block text-fine text-ink-2">GMC {c.gmc || '—'}</span>
                    <span className="block text-fine text-ink-2">Joined {fmtDate(c.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

async function GpTable({ db, params, query }: {
  db: DB;
  params: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
}) {
  const list = parseListQuery('gp', params);
  const [result, sources] = await Promise.all([listSignups(db, list), sourcesFor(db, 'gp')]);
  const filtered = Boolean(list.q || list.status || list.source);
  const sortProps = { basePath: BASE, query };
  return (
    <>
      <ListToolbar
        basePath={BASE}
        query={query}
        placeholder="Search by name, email or GMC number"
        filters={[
          { name: 'status', label: 'Status', options: statusesFor('gp').map((s) => ({ value: s, label: statusLabel('gp', s) })) },
          { name: 'source', label: 'Form', options: sources.map((s) => ({ value: s, label: sourceLabel(s) })) },
        ]}
      />
      <Card className="block px-4 py-3 max-phone:px-2">
        {result.total === 0 ? (
          <EmptyState className="my-2">{filtered ? 'No GPs match these filters.' : 'No GP applications yet.'}</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Name" column="name" {...sortProps} />
                <SortHeader label="Email" column="email" className="max-cols:hidden" {...sortProps} />
                <SortHeader label="Joined" column="joined" defaultDir="desc" className="max-phone:hidden" {...sortProps} />
                <SortHeader label="Status" column="status" {...sortProps} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/admin/waitlist/gps/${r.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">{r.name || r.email}</Link>
                    <span className="block text-fine text-ink-2">GMC {r.gmc || '—'}</span>
                  </TableCell>
                  <TableCell className="text-ink-2 break-all whitespace-normal max-cols:hidden">{r.email}</TableCell>
                  <TableCell className="text-ink-2 max-phone:hidden">{fmtDate(r.createdAt)}</TableCell>
                  <TableCell><StatusBadge role="gp" status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={list.pageSize}
        basePath={BASE} query={query} noun={['GP', 'GPs']} />
    </>
  );
}
