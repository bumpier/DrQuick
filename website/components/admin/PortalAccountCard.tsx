import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtCount, fmtDate } from '@/lib/admin/format';
import type { GpAccountStatus } from '@/lib/db/schema';
import type { PortalAccount } from '@/lib/doctor/admin';
import { formatRating, ratingsLabel } from '@/lib/rating-rules';
import { PauseDoctorButton, SendDoctorLinkButton } from './PortalControls';

const STATUS: Record<GpAccountStatus, { label: string; note: string }> = {
  onboarding: { label: 'Not approved yet', note: 'They can sign in and edit their profile. Mark the application Active to let them go online.' },
  active: { label: 'Active', note: 'They can go online and take consultations.' },
  paused: { label: 'Paused', note: 'They can sign in but cannot go online until resumed.' },
  offboarded: { label: 'Offboarded', note: 'They cannot sign in.' },
};

// A GP's portal account, beside their application: whether they have claimed
// it, where it stands, and the two things the team can do to it. Approval
// itself is the Status control above: the account follows the application.
export function PortalAccountCard({ signupId, account }: { signupId: string; account: PortalAccount | null }) {
  if (!account) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>Doctor portal</CardTitle>
          <CardDescription>
            Not set up yet. They do it themselves at /doctor/register with this email address, or you can send them the link.
          </CardDescription>
        </CardHeader>
        <CardContent><SendDoctorLinkButton id={signupId} claimed={false} /></CardContent>
      </Card>
    );
  }

  const status = STATUS[account.status];
  const { average, count } = account.rating;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Doctor portal</CardTitle>
        <CardDescription>{status.note}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-fine font-semibold text-ink-2">Account</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <Badge variant={account.status === 'active' ? 'success' : 'secondary'}>{status.label}</Badge>
              {account.online && <Badge>Online now</Badge>}
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-fine font-semibold text-ink-2">Set up</dt>
            <dd>{account.claimed ? fmtDate(account.createdAt) : 'No password set'}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-fine font-semibold text-ink-2">Completed consultations</dt>
            <dd className="tabular-nums">{fmtCount(account.completed)}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-fine font-semibold text-ink-2">Rating</dt>
            <dd className="tabular-nums">
              {average === null ? <span className="text-ink-2">No ratings yet</span> : `${formatRating(average)} from ${ratingsLabel(count)}`}
            </dd>
          </div>
        </dl>
        <div className="grid justify-items-start gap-3">
          {(account.status === 'active' || account.status === 'paused') && (
            <PauseDoctorButton id={signupId} paused={account.status === 'paused'} />
          )}
          {account.status !== 'offboarded' && <SendDoctorLinkButton id={signupId} claimed={account.claimed} />}
        </div>
      </CardContent>
    </Card>
  );
}
