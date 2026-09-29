import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { VisitorTimeline } from '@/components/admin/VisitorTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtDuration } from '@/lib/admin/analytics-labels';
import { firstTouchChannel, fmtCount, fmtDateTime, hostOf } from '@/lib/admin/format';
import { visitorJourney } from '@/lib/admin/queries/journey';
import { signupsForVisitor } from '@/lib/admin/queries/visitors';
import { getDb } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = { title: 'Visitor' };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-t border-rule py-2.5 first:border-t-0 max-phone:grid-cols-1 max-phone:gap-0.5">
      <dt className="text-fine font-semibold text-ink-2">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const back = { href: '/admin/analytics/visitors', label: 'All visitors' };
  const db = await getDb();
  if (!db) return <><AdminPageHeader title="Visitor" back={back} /><NoDatabase /></>;

  const journey = await visitorJourney(db, id);
  if (!journey?.visitor) notFound();
  const v = journey.visitor;
  const signups = await signupsForVisitor(db, v.id);
  const ownHost = hostOf(siteUrl().toString());
  const none = <span className="text-ink-2">—</span>;

  return (
    <>
      <AdminPageHeader
        title={signups[0]?.email ?? `Visitor ${v.id.slice(0, 8)}`}
        description="One person who accepted analytics: where they came from, and every visit, page and action since."
        back={back}
      />
      <KpiRow className="grid-cols-4 max-forms:grid-cols-2">
        <Kpi label="Visits" value={fmtCount(v.sessions)} />
        <Kpi label="Pages viewed" value={fmtCount(v.pageviews)} />
        <Kpi label="Engaged time" value={fmtDuration(v.engagedSeconds)} />
        <Kpi label="Signed up" value={signups.length ? 'Yes' : 'No'} note={signups.length ? signups.map((s) => (s.role === 'gp' ? 'GP' : 'Patient')).join(' and ') : 'Not on the waitlist'} />
      </KpiRow>

      <div className="mt-4 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-4 max-forms:grid-cols-1">
        <Card size="sm">
          <CardHeader><CardTitle>First touch and device</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <Field label="Visitor id"><span className="font-mono text-fine break-all">{v.id}</span></Field>
              <Field label="First seen">{fmtDateTime(v.firstSeen)}</Field>
              <Field label="Last seen">{fmtDateTime(v.lastSeen)}</Field>
              <Field label="First came from">{firstTouchChannel({ utmSource: v.firstUtmSource, referrer: v.firstReferrer }, ownHost)}</Field>
              {(v.firstUtmMedium || v.firstUtmCampaign) && <Field label="Campaign">{[v.firstUtmMedium, v.firstUtmCampaign].filter(Boolean).join(' · ')}</Field>}
              {v.firstReferrer && <Field label="Referrer"><span className="font-mono text-fine break-all">{v.firstReferrer}</span></Field>}
              <Field label="Landed on">{v.firstPath ? <span className="font-mono text-fine">{v.firstPath}</span> : none}</Field>
              <Field label="Device">{[v.device, v.browser, v.os].filter(Boolean).join(' · ') || none}</Field>
              <Field label="Sign-up">
                {signups.length === 0 ? none : (
                  <ul className="grid gap-1">
                    {signups.map((s) => (
                      <li key={s.id}>
                        <Link href={`/admin/waitlist/${s.role === 'gp' ? 'gps' : 'patients'}/${s.id}`} className="font-semibold break-all text-primary-ink">{s.email}</Link>
                        <span className="text-fine text-ink-2"> · {s.role === 'gp' ? 'GP' : 'patient'} · {fmtDateTime(s.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
            </dl>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-0">
          <CardHeader><CardTitle>Journey</CardTitle></CardHeader>
          <CardContent>
            <VisitorTimeline sessions={journey.sessions} truncated={journey.truncated} ownHost={ownHost} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
