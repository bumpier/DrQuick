import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { AutoRefresh } from '@/components/admin/AutoRefresh';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtDuration } from '@/lib/admin/analytics-labels';
import { ago, firstTouchChannel, fmtCount, hostOf } from '@/lib/admin/format';
import { liveNow } from '@/lib/admin/queries/visitors';
import { getDb } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = { title: 'Live' };

export default async function LivePage() {
  await requireAdmin();
  const header = (
    <AdminPageHeader title="Live" description="Who is on the site right now: visits active in the last five minutes." actions={<AutoRefresh seconds={10} />} />
  );
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const now = new Date();
  const live = await liveNow(db, now);
  const ownHost = hostOf(siteUrl().toString());

  return (
    <>
      {header}
      <KpiRow>
        <Kpi label="Active visits" value={fmtCount(live.total)} note="Consented visits seen in the last 5 minutes" />
        <Kpi label="Anonymous page views" value={fmtCount(live.cookieless)} note="From visitors who declined analytics, last 5 minutes" />
      </KpiRow>
      <Card className="mt-4 block px-4 py-3 max-phone:px-2">
        {live.sessions.length === 0 ? <EmptyState className="my-2">Nobody with analytics on is on the site right now.</EmptyState> : (
          <Table stack="cols">
            <TableHeader>
              <TableRow>
                <TableHead>Now on</TableHead>
                <TableHead>Came in on</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead className="text-right">On site</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {live.sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell data-label="Now on">
                    {s.visitorId
                      ? <Link href={`/admin/analytics/visitors/${s.visitorId}`} className="font-mono font-semibold text-primary-ink">{s.currentPath}</Link>
                      : <span className="font-mono">{s.currentPath}</span>}
                  </TableCell>
                  <TableCell data-label="Came in on"><span className="font-mono">{s.entryPath}</span></TableCell>
                  <TableCell data-label="Device" className="capitalize">{s.device}</TableCell>
                  <TableCell data-label="From">{firstTouchChannel({ utmSource: s.utmSource, referrer: s.referrer }, ownHost)}</TableCell>
                  <TableCell data-label="Pages" className="text-right tabular-nums">{fmtCount(s.pageviews)}</TableCell>
                  <TableCell data-label="On site" className="text-right tabular-nums">{fmtDuration((s.lastSeen.getTime() - s.startedAt.getTime()) / 1000)}</TableCell>
                  <TableCell data-label="Last active">{ago(s.lastSeen, now)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
