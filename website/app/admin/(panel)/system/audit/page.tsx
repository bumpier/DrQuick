import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Pagination } from '@/components/admin/DataTable';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtDateTime } from '@/lib/admin/format';
import { auditFacets, auditLabel, listAudit, parseAuditQuery, summariseMeta } from '@/lib/admin/queries/system';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Audit log' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/system/audit';

// Where a target id leads, when it is a sign-up still on the list.
function targetHref(action: string, target: string | null, meta: Record<string, unknown> | null): string | null {
  if (!target || !/^[0-9a-f-]{36}$/i.test(target) || action === 'erase_person' || action === 'self_erasure') return null;
  return meta?.role === 'gp' ? `/admin/waitlist/gps/${target}` : meta?.role === 'patient' ? `/admin/waitlist/patients/${target}` : null;
}

export default async function AuditPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const query = flatParams(params);
  const header = (
    <AdminPageHeader
      title="Audit log"
      description="Everything an admin has changed, erased or downloaded, and every self-service erasure. It never holds the address of the person acted on."
    />
  );
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const q = parseAuditQuery(params);
  const [result, facets] = await Promise.all([listAudit(db, q), auditFacets(db)]);
  const filtered = Boolean(q.admin || q.action);

  return (
    <>
      {header}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <QuerySelect label="Who" name="admin" value={q.admin ?? null} basePath={BASE} query={query} allLabel="Everyone" clear={['page']}
          options={facets.admins.map((a) => ({ value: a, label: a === 'self-service' ? 'The person themselves' : a }))} />
        <QuerySelect label="Action" name="action" value={q.action ?? null} basePath={BASE} query={query} allLabel="All" clear={['page']}
          options={facets.actions.map((a) => ({ value: a, label: auditLabel(a) }))} />
        {filtered && (
          <Link href={withQuery(BASE, query, { admin: null, action: null, page: null })} className="inline-flex h-12 items-center text-fine font-semibold text-primary-ink">
            Clear filters
          </Link>
        )}
      </div>
      <Card className="block px-4 py-3 max-phone:px-2">
        {result.total === 0 ? (
          <EmptyState className="my-2">{filtered ? 'Nothing matches these filters.' : 'Nothing recorded yet.'}</EmptyState>
        ) : (
          <Table stack="cols">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((r) => {
                const href = targetHref(r.action, r.target, r.meta);
                return (
                  <TableRow key={r.id}>
                    <TableCell data-label="When" className="text-ink-2 tabular-nums">{fmtDateTime(r.createdAt)}</TableCell>
                    <TableCell data-label="Who" className="break-all whitespace-normal">{r.admin === 'self-service' ? 'The person themselves' : r.admin}</TableCell>
                    <TableCell data-label="What" className="whitespace-normal">
                      {href ? <Link href={href} className="font-semibold text-primary-ink">{auditLabel(r.action)}</Link> : <span className="font-semibold">{auditLabel(r.action)}</span>}
                    </TableCell>
                    <TableCell data-label="Details" className="whitespace-normal text-ink-2">{summariseMeta(r.action, r.meta) || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={q.pageSize}
        basePath={BASE} query={query} noun={['entry', 'entries']} />
    </>
  );
}
