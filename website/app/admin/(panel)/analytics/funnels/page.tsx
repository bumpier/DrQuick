import type { Metadata } from 'next';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { FunnelChart } from '@/components/admin/FunnelChart';
import { Control, LinkToggle } from '@/components/admin/LinkToggle';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { RankTable } from '@/components/admin/RankTable';
import { Card, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-auth';
import { DEVICE_BUCKETS, DEVICE_LABELS, errorLabel, fieldLabel } from '@/lib/admin/analytics-labels';
import { fmtCount, fmtPct } from '@/lib/admin/format';
import { funnels, parseSegment } from '@/lib/admin/queries/funnels';
import { param, parseRange } from '@/lib/admin/range';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Funnels' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/analytics/funnels';

export default async function FunnelsPage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const params = await searchParams;
  const query = flatParams(params);
  const range = parseRange(params, now);
  const seg = parseSegment(params);
  const pay = param(params, 'pay') !== 'off';

  const header = <AdminPageHeader title="Funnels" description="Where people drop out between landing on the page and joining the waitlist." />;
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const f = await funnels(db, range, seg, pay);
  const sources = seg.source && seg.source !== 'direct' && !f.sources.includes(seg.source) ? [seg.source, ...f.sources] : f.sources;
  const conversion = (steps: typeof f.patient.steps) => (steps[0].value > 0 ? steps.at(-1)!.value / steps[0].value : null);

  return (
    <>
      {header}
      <DateRangePicker range={range} basePath={BASE} keep={{ device: query.device, source: query.source, pay: query.pay }} now={now} />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <Control label="Device">
          <LinkToggle label="Device" options={[
            { href: withQuery(BASE, query, { device: null }), label: 'All', current: seg.device === null },
            ...DEVICE_BUCKETS.map((d) => ({ href: withQuery(BASE, query, { device: d }), label: DEVICE_LABELS[d], current: seg.device === d })),
          ]} />
        </Control>
        <QuerySelect label="Source" name="source" value={seg.source} basePath={BASE} query={query} allLabel="All sources"
          options={[{ value: 'direct', label: 'Direct (no campaign, no referrer)' }, ...sources.map((s) => ({ value: s, label: s }))]} />
      </div>

      <p className="mb-4 max-w-[80ch] text-fine text-ink-2">
        Each step counts landing-page views by visitors who accepted analytics. A view counts at a step only if it reached every step before it; a submitted form counts as seen and started.
      </p>

      <div className="grid grid-cols-2 gap-4 max-forms:grid-cols-1">
        <Card className="block min-w-0 px-6 py-6 max-phone:px-4">
          <CardTitle>Patients</CardTitle>
          <p className="mt-1 mb-5 text-fine text-ink-2">
            {conversion(f.patient.steps) === null ? 'No patient-mode views in this range.' : `${fmtPct(conversion(f.patient.steps))} of patient-mode views joined the waitlist.`}
          </p>
          {f.patient.steps[0].value === 0
            ? <EmptyState>No patient-mode views in this range.</EmptyState>
            : <FunnelChart ariaLabel="Patient sign-up funnel" steps={f.patient.steps} />}
        </Card>
        <Card className="block min-w-0 px-6 py-6 max-phone:px-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>GPs</CardTitle>
            <LinkToggle label="Pay section step" options={[
              { href: withQuery(BASE, query, { pay: null }), label: 'With pay step', current: pay },
              { href: withQuery(BASE, query, { pay: 'off' }), label: 'Without', current: !pay },
            ]} />
          </div>
          <p className="mt-1 mb-5 text-fine text-ink-2">
            {conversion(f.gp.steps) === null ? 'No GP-mode views in this range.' : `${fmtPct(conversion(f.gp.steps))} of GP-mode views${pay ? ' went through the pay section and' : ''} applied.`}
          </p>
          {f.gp.steps[0].value === 0
            ? <EmptyState>No GP-mode views in this range.</EmptyState>
            : <FunnelChart ariaLabel="GP application funnel" steps={f.gp.steps} />}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 max-cols:grid-cols-1">
        <RankTable
          title="Where GPs left the form"
          description={f.lastField.abandoned === 0
            ? 'GPs who started the form and did not finish: the last field they were in.'
            : `${fmtCount(f.lastField.abandoned)} GP ${f.lastField.abandoned === 1 ? 'view' : 'views'} started the form and did not finish. The last field each was in:`}
          head="Last field" valueLabel="Views"
          rows={f.lastField.fields.map((r) => ({
            key: r.field ?? '—', label: r.field ? fieldLabel(r.field) : 'Left before any field', value: r.views,
          }))}
          empty="Nobody abandoned the GP form in this range."
        />
        <RankTable
          title="GP form errors"
          description="Validation errors shown, by field."
          head="Field and error" valueLabel="Times"
          rows={f.errors.map((r) => ({ key: `${r.field}|${r.error}`, label: `${fieldLabel(r.field)}: ${errorLabel(r.error)}`, value: r.count }))}
          empty="No errors on the GP form in this range."
        />
      </div>
    </>
  );
}
