'use client';

/* One consultation. The id comes from the URL and is only ever compared with
   the ids on file, never echoed back. A consultation this session created has
   no prerendered page, so its URL is served on demand and the record appears
   from the provider; an id nobody holds, or any id after a reload, shows the
   honest placeholder rather than a 404, because the router cannot tell a
   record the patient just made from one that never existed. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { Facts } from '@/components/app/Facts';
import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { money } from '@/lib/format';
import { consultationIdFromPath, type ConsultationRow } from '@/lib/patient';
import { DASH } from '@/lib/placeholder';
import { NARROW_PAGE } from './page';
import { usePatient } from './PatientProvider';

const minutesLabel = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;
const SECTION = 'mb-3 text-xl leading-[1.3] font-semibold tracking-[-.02em]';

function Detail({ record }: { record: ConsultationRow }) {
  const cancelled = record.status === 'cancelled';
  const outcome = record.outcome;
  return (
    <>
      <PageHeader
        title={record.reason}
        lead={cancelled ? `${record.date} · cancelled before a GP accepted it` : `${record.date} · ${minutesLabel(record.minutes)} with ${record.gp}`}
      />
      <Facts
        items={[
          ['Reference', record.id],
          ['Date', record.date],
          ['GP', record.gp ?? 'None — no GP accepted'],
          ['Length', cancelled ? DASH : minutesLabel(record.minutes)],
          ['Recording', cancelled ? 'No call took place' : 'The call was not recorded'],
        ]}
      />
      <section aria-labelledby="outcome-title" className="mt-10">
        <h2 id="outcome-title" className={SECTION}>Outcome</h2>
        {outcome ? (
          <Facts
            items={[
              ['Prescription', outcome.prescription ? 'Sent to your pharmacy' : 'None issued'],
              ['Referral', outcome.referral ? 'Referred on to your NHS GP' : 'None needed'],
              ['Fit note', outcome.fitNote ? 'Issued' : 'Not issued'],
              ['Shared with your NHS GP', outcome.sharedWithNhsGp ? 'Yes, as you agreed' : 'No, you chose not to share'],
            ]}
          />
        ) : (
          <EmptyState>No outcome. This consultation was cancelled before a GP accepted it.</EmptyState>
        )}
      </section>
      <section aria-labelledby="receipt-title" className="mt-10">
        <h2 id="receipt-title" className={SECTION}>Receipt</h2>
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">Consultation</p>
              {!cancelled && (
                <p className="text-fine text-ink-2">Includes writing any prescription you need. The pharmacy charges separately for the medicine.</p>
              )}
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{record.cost === 0 ? 'No charge' : money(record.cost)}</span>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Placeholder() {
  return (
    <>
      <PageHeader title="No consultation selected" lead="Pick one from your consultations to see what came out of it." />
      <Facts
        items={[
          ['Reference', DASH],
          ['Date', DASH],
          ['GP', DASH],
          ['Length', DASH],
          ['Recording', 'Calls are never recorded'],
        ]}
      />
      <section aria-labelledby="outcome-title" className="mt-10">
        <h2 id="outcome-title" className={SECTION}>Outcome</h2>
        <EmptyState>No outcome yet.</EmptyState>
      </section>
    </>
  );
}

export function ConsultationDetail() {
  const id = consultationIdFromPath(usePathname());
  const { history } = usePatient();
  const record = id ? history.find((row) => row.id === id) ?? null : null;
  return (
    <div data-screen="consultation-detail" className={NARROW_PAGE}>
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
        <Link href="/patient/consultations">
          <ArrowLeftIcon strokeWidth={2} aria-hidden="true" />
          Back to consultations
        </Link>
      </Button>
      {record ? <Detail record={record} /> : <Placeholder />}
    </div>
  );
}
