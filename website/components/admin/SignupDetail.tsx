import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLinkIcon, MailIcon, PhoneIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { emailLog } from '@/lib/db/schema';
import { GP_STATUSES, PATIENT_STATUSES } from '@/lib/db/schema';
import { fmtDateTime, firstTouchChannel, sourceLabel, statusLabel } from '@/lib/admin/format';
import { humanEmailError } from '@/lib/admin/email-errors';
import type { Journey } from '@/lib/admin/queries/journey';
import type { Signup } from '@/lib/waitlist';
import { gbp } from '@/lib/money';
import { EraseButton, NotesControl, ResendButton, StatusControl } from './SignupControls';
import { FeeBadge, StatusBadge } from './StatusBadge';
import { VisitorTimeline } from './VisitorTimeline';

type EmailRow = typeof emailLog.$inferSelect;

// The GMC's public register search. The number is only a search term: the
// admin checks the result by eye, so the link needs no particular format.
export const gmcSearchUrl = (gmc: string) => `https://www.gmc-uk.org/search-the-register?search=${encodeURIComponent(gmc)}`;

// The payment in the Stripe Dashboard, where a refund is made. A test-mode
// payment lives under /test; the checkout session id says which mode it was.
export const stripePaymentUrl = (paymentIntentId: string, sessionId?: string | null) =>
  `https://dashboard.stripe.com/${sessionId?.startsWith('cs_test_') ? 'test/' : ''}payments/${encodeURIComponent(paymentIntentId)}`;

const TEMPLATE_LABELS: Record<string, string> = {
  patient_welcome: 'You’re on the list',
  gp_received: 'Application received',
  admin_new_gp: 'New GP alert to the team',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-rule py-3 first:border-t-0 max-phone:grid-cols-1 max-phone:gap-0.5">
      <dt className="text-fine font-semibold text-ink-2">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function SignupDetail({ signup, emails, journey, ownHost }: {
  signup: Signup;
  emails: EmailRow[];
  journey: Journey | null;
  ownHost: string | null;
}) {
  const gp = signup.role === 'gp';
  const statuses = gp ? GP_STATUSES : PATIENT_STATUSES;
  const none = <span className="text-ink-2">—</span>;

  return (
    <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4 max-forms:grid-cols-1">
      <div className="grid min-w-0 gap-4">
        <Card size="sm">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <dl>
              {gp && <Field label="Name">{signup.name || none}</Field>}
              <Field label="Email">
                <a href={`mailto:${signup.email}`} className="inline-flex items-center gap-1.5 font-semibold break-all text-primary-ink">
                  <MailIcon strokeWidth={2} className="size-4 shrink-0" aria-hidden="true" />{signup.email}
                </a>
              </Field>
              {gp && (
                <Field label="Mobile">
                  {signup.mobile ? (
                    <a href={`tel:${signup.mobile.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 font-semibold text-primary-ink">
                      <PhoneIcon strokeWidth={2} className="size-4 shrink-0" aria-hidden="true" />{signup.mobile}
                    </a>
                  ) : none}
                </Field>
              )}
              {gp && (
                <Field label="GMC number">
                  {signup.gmc ? (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold tabular-nums">{signup.gmc}</span>
                      <a href={gmcSearchUrl(signup.gmc)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fine font-semibold text-primary-ink">
                        Check the GMC register
                        <ExternalLinkIcon strokeWidth={2} className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </span>
                  ) : none}
                </Field>
              )}
              <Field label="Status"><StatusBadge role={signup.role} status={signup.status} /></Field>
              {gp && (
                <Field label="Sign-up fee">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <FeeBadge status={signup.feeStatus} />
                    {signup.feePaidAt && (
                      <span className="tabular-nums">{gbp(signup.feePence)}, {fmtDateTime(signup.feePaidAt)}</span>
                    )}
                    {signup.stripePaymentIntentId && (
                      <a href={stripePaymentUrl(signup.stripePaymentIntentId, signup.stripeCheckoutSessionId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fine font-semibold text-primary-ink">
                        Open the payment in Stripe
                        <ExternalLinkIcon strokeWidth={2} className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                  </span>
                  {signup.feeStatus === 'paid' && (
                    <span className="mt-1 block text-fine text-ink-2">
                      The fee is promised back in full if the GMC check fails or they are not taken on. Refund it in Stripe and this updates itself.
                    </span>
                  )}
                  {signup.feeStatus === 'unpaid' && (
                    <span className="mt-1 block text-fine text-ink-2">
                      They entered their details and left before paying. Nothing has been charged, and no confirmation email has gone out.
                    </span>
                  )}
                </Field>
              )}
              <Field label="Joined">{fmtDateTime(signup.createdAt)}</Field>
              {signup.unsubscribedAt && <Field label="Unsubscribed">{fmtDateTime(signup.unsubscribedAt)}</Field>}
              <Field label="Form">{sourceLabel(signup.source)}</Field>
              <Field label="First came from">{firstTouchChannel(signup, ownHost)}</Field>
              {(signup.utmMedium || signup.utmCampaign) && (
                <Field label="Campaign">{[signup.utmMedium, signup.utmCampaign].filter(Boolean).join(' · ')}</Field>
              )}
              {signup.referrer && <Field label="Referrer"><span className="font-mono text-fine break-all">{signup.referrer}</span></Field>}
              {signup.landingPath && <Field label="Landed on"><span className="font-mono text-fine">{signup.landingPath}</span></Field>}
            </dl>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader><CardTitle>Emails sent</CardTitle></CardHeader>
          <CardContent>
            {emails.length === 0 ? <EmptyState>No emails logged for this sign-up.</EmptyState> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="max-phone:hidden">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-normal">
                        {TEMPLATE_LABELS[e.template] ?? e.template}
                        {e.template === 'admin_new_gp' && <span className="block text-fine text-ink-2">to the team</span>}
                        {e.error && <span className="block text-fine text-ink-2">{humanEmailError(e.error)}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === 'sent' ? 'success' : e.status === 'failed' ? 'destructive' : 'secondary'}>
                          {e.status === 'sent' ? 'Sent' : e.status === 'failed' ? 'Failed' : 'Not sent'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink-2 max-phone:hidden">{fmtDateTime(e.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <JourneyCard journey={journey} visitorId={signup.visitorId} ownHost={ownHost} />
      </div>

      <div className="grid min-w-0 gap-4">
        <Card size="sm">
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent>
            <StatusControl id={signup.id} status={signup.status} options={statuses.map((s) => ({ value: s, label: statusLabel(signup.role, s) }))} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><NotesControl id={signup.id} notes={signup.notes} /></CardContent>
        </Card>
        <Card size="sm" variant="quiet">
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="grid justify-items-start gap-3">
            <ResendButton id={signup.id} role={signup.role} />
            <EraseButton id={signup.id} email={signup.email} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function JourneyCard({ journey, visitorId, ownHost }: { journey: Journey | null; visitorId: string | null; ownHost: string | null }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Visit history</CardTitle>
        {visitorId && journey?.visitor && (
          <Link href={`/admin/analytics/visitors/${visitorId}`} className="text-fine font-semibold text-primary-ink">Open this visitor</Link>
        )}
      </CardHeader>
      <CardContent>
        {!visitorId || !journey ? (
          <EmptyState>No visit history. This person did not accept analytics cookies, or signed up before tracking began.</EmptyState>
        ) : (
          <VisitorTimeline sessions={journey.sessions} truncated={journey.truncated} ownHost={ownHost} />
        )}
      </CardContent>
    </Card>
  );
}
