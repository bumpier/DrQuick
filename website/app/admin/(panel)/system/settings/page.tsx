import type { Metadata } from 'next';
import { DownloadIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EraseByEmail } from '@/components/admin/SystemControls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminAccounts, requireAdmin } from '@/lib/admin-auth';

export const metadata: Metadata = { title: 'Settings' };

const RETENTION: Array<{ what: string; kept: string }> = [
  { what: 'Waitlist sign-ups', kept: 'Until launch, and for no more than twelve months after (the promise in the FAQ). Unsubscribing deletes them at once.' },
  { what: 'Emails sent', kept: 'As long as the sign-up they belong to; erased with it.' },
  { what: 'Analytics events', kept: '13 months, then deleted by the nightly npm run analytics:prune.' },
  { what: 'Visitor cookie', kept: '13 months in the visitor’s browser, set only with consent. The consent choice itself lasts 12 months.' },
  { what: 'Database backups', kept: 'Nightly pg_dump, each kept for 14 days (docs/postgres-vps.md).' },
  { what: 'Audit log', kept: 'Kept. It records what happened and by whom, never the address of the person acted on.' },
];

const DOWNLOAD = 'inline-flex h-12 items-center gap-2 rounded-pill bg-white px-5 font-semibold text-ink no-underline ring-2 ring-ink ring-inset hover:bg-surface-mid';

export default async function SettingsPage() {
  const me = await requireAdmin();
  const admins = [...adminAccounts().values()].map(({ email, name }) => ({ email, name }));

  return (
    <>
      <AdminPageHeader title="Settings" description="Who can sign in, how long data is kept, and the data-protection tools." />

      <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>Admins</CardTitle>
            <p className="text-fine text-ink-2">From ADMIN_USERS on the server. Add one with npm run admin:hash; removing an entry signs that admin out.</p>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? <EmptyState>No admins configured.</EmptyState> : (
              <ul className="grid gap-2">
                {admins.map((a) => (
                  <li key={a.email} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-rule pb-2 last:border-0">
                    <span className="font-semibold">{a.name}{a.email === me.email && <span className="font-normal text-ink-2"> (you)</span>}</span>
                    <span className="text-fine break-all text-ink-2">{a.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>Download the waitlists</CardTitle>
            <p className="text-fine text-ink-2">Everyone on each list as CSV. Each download is recorded in the audit log.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a href="/admin/waitlist/export?role=patient" download className={DOWNLOAD}>
              <DownloadIcon strokeWidth={2} className="size-5" aria-hidden="true" /> Patients (CSV)
            </a>
            <a href="/admin/waitlist/export?role=gp" download className={DOWNLOAD}>
              <DownloadIcon strokeWidth={2} className="size-5" aria-hidden="true" /> GPs (CSV)
            </a>
          </CardContent>
        </Card>
      </div>

      <Card size="sm" className="mt-4 min-w-0">
        <CardHeader>
          <CardTitle>How long data is kept</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3">
            {RETENTION.map((r) => (
              <div key={r.what} className="grid grid-cols-[minmax(0,14rem)_1fr] gap-4 border-b border-rule pb-3 last:border-0 max-phone:grid-cols-1 max-phone:gap-1">
                <dt className="font-semibold">{r.what}</dt>
                <dd className="text-ink-2">{r.kept}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card size="sm" className="mt-4 min-w-0">
        <CardHeader>
          <CardTitle>Erase a person</CardTitle>
          <p className="text-fine text-ink-2">
            For a right-to-erasure request. Deletes every sign-up for the address, the visit history linked to it and the emails sent to it.
          </p>
        </CardHeader>
        <CardContent><EraseByEmail /></CardContent>
      </Card>
    </>
  );
}
