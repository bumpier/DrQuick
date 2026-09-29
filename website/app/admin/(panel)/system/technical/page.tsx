import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { ago, fmtCount, fmtDateTime } from '@/lib/admin/format';
import { humanEmailError, templateLabel } from '@/lib/admin/email-errors';
import {
  analyticsHealth, buildInfo, databaseHealth, emailHealth, envChecklist, recentErrors, stripeHealth,
} from '@/lib/admin/queries/system';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Technical' };
export const dynamic = 'force-dynamic';

type Tone = 'ok' | 'off' | 'problem';
const TONE: Record<Tone, { label: string; variant: 'success' | 'secondary' | 'destructive' }> = {
  ok: { label: 'Working', variant: 'success' },
  off: { label: 'Not set up', variant: 'secondary' },
  problem: { label: 'Needs a look', variant: 'destructive' },
};

function Health({ title, tone, children }: { title: string; tone: Tone; children: ReactNode }) {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Badge variant={TONE[tone].variant}>{TONE[tone].label}</Badge>
      </CardHeader>
      <CardContent><dl className="grid gap-2">{children}</dl></CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-fine text-ink-2">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words text-ink tabular-nums">{children}</dd>
    </div>
  );
}

const bytes = (b: number | null) => {
  if (b === null) return '—';
  const mb = b / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};

export default async function TechnicalPage() {
  await requireAdmin();
  const now = new Date();
  const db = await getDb();
  const env = envChecklist();
  const build = buildInfo();
  const [dbh, mail, stripe, analytics, errors] = db
    ? await Promise.all([databaseHealth(db), emailHealth(db, now), stripeHealth(db), analyticsHealth(db, now), recentErrors(db)])
    : [null, null, null, null, []];

  const migrationsBehind = dbh && dbh.migrations.applied !== null && dbh.migrations.applied < dbh.migrations.files;
  const dbTone: Tone = !dbh ? 'off' : !dbh.ok || migrationsBehind || dbh.migrations.applied === null ? 'problem' : 'ok';
  const mailTone: Tone = !mail?.configured ? 'off' : mail.week.failed > 0 ? 'problem' : 'ok';
  const stripeTone: Tone = stripe?.configured ? 'ok' : 'off';
  const analyticsTone: Tone = !analytics ? 'off' : analytics.collectErrors24h > 0 ? 'problem' : 'ok';
  const setCount = env.filter((v) => v.set).length;

  return (
    <>
      <AdminPageHeader title="Technical" description="Whether each part of the site is working, what is configured, and what went wrong lately." />

      <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
        <Health title="Database" tone={dbTone}>
          {!dbh ? <p className="text-body text-ink-2">No DATABASE_URL on this server, so nothing is stored.</p> : <>
            <Row label="Connection">{dbh.ok ? `${dbh.latencyMs} ms to answer` : dbh.error}</Row>
            <Row label="Engine">{dbh.driver === 'postgres' ? 'Postgres' : 'PGlite (in-process, development)'}{dbh.version ? ` ${dbh.version}` : ''}</Row>
            <Row label="Migrations">
              {dbh.migrations.applied === null ? 'Never migrated' : `${dbh.migrations.applied} of ${dbh.migrations.files} applied`}
              {migrationsBehind && <span className="block text-fine font-normal text-error">Run npm run db:migrate</span>}
            </Row>
            {dbh.migrations.lastAppliedAt && <Row label="Last migration">{fmtDateTime(dbh.migrations.lastAppliedAt)}</Row>}
            <Row label="Size on disk">{bytes(dbh.sizeBytes)}</Row>
          </>}
        </Health>

        <Health title="Email (Resend)" tone={mailTone}>
          <Row label="Set up">{mail?.configured ? 'Yes' : 'No — RESEND_API_KEY and EMAIL_FROM'}</Row>
          <Row label="Last attempt">
            {mail?.last ? `${templateLabel(mail.last.template)}, ${mail.last.status === 'sent' ? 'sent' : mail.last.status === 'failed' ? 'failed' : 'not sent'} ${ago(mail.last.at, now)}` : 'None yet'}
            {mail?.last?.status === 'failed' && <span className="block text-fine font-normal text-ink-2">{humanEmailError(mail.last.error)}</span>}
          </Row>
          <Row label="Last 7 days">
            {mail ? `${fmtCount(mail.week.sent)} sent · ${fmtCount(mail.week.failed)} failed · ${fmtCount(mail.week.skipped)} not sent` : '—'}
          </Row>
        </Health>

        <Health title="Payments (Stripe)" tone={stripeTone}>
          <Row label="Secret key">{stripe?.secretKey ? 'Set' : 'Not set'}</Row>
          <Row label="Webhook secret">{stripe?.webhookSecret ? 'Set' : 'Not set'}</Row>
          <Row label="Webhook">{stripe?.configured ? 'Listening at /api/webhooks/stripe' : 'Answers 501 until both are set'}</Row>
          <Row label="Last event">{stripe?.lastEvent ? `${stripe.lastEvent.type}, ${ago(stripe.lastEvent.at, now)}` : 'None yet'}</Row>
        </Health>

        <Health title="Analytics" tone={analyticsTone}>
          <Row label="Events, last 24 hours">{analytics ? fmtCount(analytics.events24h) : '—'}</Row>
          <Row label="Latest event">{analytics?.lastEventAt ? ago(analytics.lastEventAt, now) : 'None yet'}</Row>
          <Row label="Collect errors, last 24 hours">{analytics ? fmtCount(analytics.collectErrors24h) : '—'}</Row>
        </Health>
      </div>

      <div className="mt-4 grid grid-cols-[3fr_2fr] gap-4 max-forms:grid-cols-1">
        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <p className="text-fine text-ink-2">{setCount} of {env.length} set. Whether each variable is set, never its value.</p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {env.map((v) => (
                <li key={v.name} className="flex items-start justify-between gap-3 border-b border-rule pb-2 last:border-0">
                  <span className="min-w-0">
                    <code className="font-mono text-fine font-semibold break-all text-ink">{v.name}</code>
                    {v.about && <span className="block text-fine text-ink-2">{v.about}</span>}
                  </span>
                  <Badge variant={v.set ? 'success' : 'secondary'}>{v.set ? 'Set' : 'Not set'}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card size="sm" className="min-w-0">
            <CardHeader><CardTitle>Build</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-2">
                <Row label="Running">{build.env}</Row>
                <Row label="Node">{build.node}</Row>
                <Row label="Next.js">{build.next ?? '—'}</Row>
                <Row label="Commit"><code className="font-mono">{build.sha ?? 'unknown'}</code></Row>
                <Row label="Built">{build.builtAt ? fmtDateTime(build.builtAt) : '—'}</Row>
              </dl>
            </CardContent>
          </Card>

          <Card size="sm" className="min-w-0">
            <CardHeader>
              <CardTitle>Tables</CardTitle>
              <p className="text-fine text-ink-2">Rows in each table{dbh?.tables.some((t) => t.approx) ? '; "approx" is the planner’s estimate' : ''}.</p>
            </CardHeader>
            <CardContent>
              {!dbh?.tables.length ? <EmptyState>No database.</EmptyState> : (
                <dl className="grid gap-1.5">
                  {dbh.tables.map((t) => (
                    <Row key={t.name} label={t.name}>{fmtCount(t.rows)}{t.approx ? ' approx' : ''}</Row>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card size="sm" className="mt-4 min-w-0">
        <CardHeader>
          <CardTitle>Recent errors</CardTitle>
          <p className="text-fine text-ink-2">Server-side failures the site logged, newest first.</p>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? <EmptyState>No errors logged.</EmptyState> : (
            <Table stack="cols">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead>What</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell data-label="When" className="text-ink-2 tabular-nums">{fmtDateTime(e.createdAt)}</TableCell>
                    <TableCell data-label="Where"><code className="font-mono text-fine">{e.route}</code></TableCell>
                    <TableCell data-label="What" className="whitespace-normal break-words">{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
