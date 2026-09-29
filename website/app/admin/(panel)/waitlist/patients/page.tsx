import type { Metadata } from 'next';
import { DownloadIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Pagination, SortHeader } from '@/components/admin/DataTable';
import { ErasedNotice } from '@/components/admin/ErasedNotice';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { PatientsTable } from '@/components/admin/PatientsTable';
import { Card } from '@/components/ui/card';
import { TableHead } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { firstTouchChannel, hostOf, sourceLabel, statusLabel } from '@/lib/admin/format';
import { listSignups, parseListQuery, sourcesFor, statusesFor } from '@/lib/admin/queries/waitlist';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = { title: 'Patients' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/waitlist/patients';

export default async function PatientsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const query = flatParams(params);
  const list = parseListQuery('patient', params);
  const db = await getDb();

  const header = (
    <AdminPageHeader
      title="Patients"
      description="Everyone on the patient waitlist. Open a row for their details, emails and visit history."
      actions={db && (
        <a href={withQuery('/admin/waitlist/export', { ...query, role: 'patient', page: undefined, notice: undefined })} download
          className="inline-flex h-12 items-center gap-2 rounded-pill bg-white px-5 font-semibold text-ink no-underline ring-2 ring-ink ring-inset hover:bg-surface-mid">
          <DownloadIcon strokeWidth={2} className="size-5" aria-hidden="true" />
          Download CSV
        </a>
      )}
    />
  );
  if (!db) return <>{header}<NoDatabase /></>;

  const [result, sources] = await Promise.all([listSignups(db, list), sourcesFor(db, 'patient')]);
  const ownHost = hostOf(siteUrl().toString());
  const filtered = Boolean(list.q || list.status || list.source);
  const sortProps = { basePath: BASE, query };

  return (
    <>
      {header}
      {query.notice === 'erased' && <ErasedNotice />}
      <ListToolbar
        basePath={BASE}
        query={query}
        placeholder="Search by email"
        filters={[
          { name: 'status', label: 'Status', options: statusesFor('patient').map((s) => ({ value: s, label: statusLabel('patient', s) })) },
          { name: 'source', label: 'Form', options: sources.map((s) => ({ value: s, label: sourceLabel(s) })) },
        ]}
      />
      <Card className="block px-4 py-3 max-phone:px-2">
        {result.total === 0 ? (
          <EmptyState className="my-2">
            {filtered ? 'No patients match these filters.' : 'No patients have joined yet. Sign-ups from the landing page appear here.'}
          </EmptyState>
        ) : (
          <PatientsTable
            rows={result.rows.map((r) => ({
              id: r.id, email: r.email, source: r.source, status: r.status, createdAt: r.createdAt,
              channel: firstTouchChannel(r, ownHost),
            }))}
            headers={<>
              <SortHeader label="Email" column="email" {...sortProps} />
              <SortHeader label="Form" column="source" className="max-cols:hidden" {...sortProps} />
              <TableHead className="max-cols:hidden">First came from</TableHead>
              <SortHeader label="Joined" column="joined" defaultDir="desc" className="max-phone:hidden" {...sortProps} />
              <SortHeader label="Status" column="status" {...sortProps} />
            </>}
          />
        )}
      </Card>
      <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={list.pageSize}
        basePath={BASE} query={query} noun={['patient', 'patients']} />
    </>
  );
}
