import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { ConsultationTable } from '@/components/admin/ConsultationTable';
import { Pagination, SortHeader } from '@/components/admin/DataTable';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { DemoBanner, DemoToggle, NOT_LIVE, Titled } from '@/components/admin/DemoMode';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableHead } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtCount, fmtPct } from '@/lib/admin/format';
import { dbSource, isDemo, parseConsultationQuery } from '@/lib/admin/queries/finance';
import { parseRange } from '@/lib/admin/range';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { demoSource } from '@/lib/finance/demo';
import {
  CONSULTATION_STATUSES, CONSULTATION_STATUS_LABELS, PAYMENT_STATES, PAYMENT_STATE_LABELS,
} from '@/lib/finance/model';

export const metadata: Metadata = { title: 'Consultations' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/finance/consultations';

export default async function ConsultationsPage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const params = await searchParams;
  const query = flatParams(params);
  const range = parseRange(params, now);
  const demo = isDemo(params);

  const header = (
    <AdminPageHeader
      title="Consultations"
      description="Every consultation requested in the range, with its price, the GP's fee, what the platform keeps and where the payment stands."
      actions={<DemoToggle basePath={BASE} query={query} demo={demo} />}
    />
  );
  const db = await getDb();
  if (!db && !demo) return <>{header}<NoDatabase /></>;
  const source = demo ? demoSource(now) : dbSource(db!);

  const list = parseConsultationQuery(params, range);
  const [result, mix, gps] = await Promise.all([source.consultations(list), source.statusMix(range), source.gps()]);
  const requested = Object.values(mix).reduce((a, b) => a + b, 0);
  const filtered = Boolean(list.status || list.payment || list.gp);
  const sortProps = { basePath: BASE, query: { ...query, sort: list.sort } };
  const keep = { ...query, from: undefined, to: undefined, page: undefined };
  const clearFilters = withQuery(BASE, query, { status: null, payment: null, gp: null, page: null });

  return (
    <>
      {header}
      {demo && <DemoBanner />}
      <DateRangePicker range={range} basePath={BASE} keep={keep} now={now} />

      <Card size="sm" className="mb-4 min-w-0">
        <CardHeader>
          <CardTitle><Titled title="Status mix" demo={demo} /></CardTitle>
          <p className="text-fine text-ink-2">{fmtCount(requested)} requested in the range.</p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-5 gap-3 max-cols:grid-cols-3 max-phone:grid-cols-2">
            {CONSULTATION_STATUSES.map((s) => (
              <div key={s} className="rounded-lg bg-surface-mid px-4 py-3">
                <dt className="text-fine text-ink-2">{CONSULTATION_STATUS_LABELS[s]}</dt>
                <dd className="mt-1 flex items-baseline gap-2">
                  <strong className="text-xl font-bold text-ink tabular-nums">{fmtCount(mix[s])}</strong>
                  <span className="text-fine text-ink-2 tabular-nums">{requested > 0 ? fmtPct(mix[s] / requested) : '—'}</span>
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <QuerySelect label="Status" name="status" value={list.status ?? null} basePath={BASE} query={query} allLabel="All" clear={['page']}
          options={CONSULTATION_STATUSES.map((s) => ({ value: s, label: CONSULTATION_STATUS_LABELS[s] }))} />
        <QuerySelect label="Payment" name="payment" value={list.payment ?? null} basePath={BASE} query={query} allLabel="All" clear={['page']}
          options={PAYMENT_STATES.map((s) => ({ value: s, label: PAYMENT_STATE_LABELS[s] }))} />
        <QuerySelect label="GP" name="gp" value={list.gp ?? null} basePath={BASE} query={query} allLabel="All GPs" clear={['page']}
          options={gps.map((g) => ({ value: g.id, label: g.name }))} />
        {filtered && <Link href={clearFilters} className="inline-flex h-12 items-center text-fine font-semibold text-primary-ink">Clear filters</Link>}
      </div>

      <Card className="block px-4 py-3 max-phone:px-2">
        {result.total === 0 ? (
          <EmptyState className="my-2">
            {filtered ? 'No consultations match these filters.' : demo ? 'No consultations in this range.' : NOT_LIVE}
          </EmptyState>
        ) : (
          <ConsultationTable rows={result.rows} headers={<>
            <SortHeader label="Requested" column="requested" defaultDir="desc" {...sortProps} />
            <SortHeader label="Status" column="status" {...sortProps} />
            <TableHead>GP</TableHead>
            <SortHeader label="Price" column="price" defaultDir="desc" className="text-right" {...sortProps} />
            <SortHeader label="GP fee" column="gp_fee" defaultDir="desc" className="text-right" {...sortProps} />
            <SortHeader label="Platform fee" column="platform_fee" defaultDir="desc" className="text-right" {...sortProps} />
          </>} />
        )}
      </Card>
      <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={list.pageSize}
        basePath={BASE} query={query} noun={['consultation', 'consultations']} />
    </>
  );
}
