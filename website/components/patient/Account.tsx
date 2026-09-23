'use client';

/* The account. Every control does something: the sharing switch is real state
   and its consequence changes with it; the three actions a live service would
   hand to its payment and data systems say, in a toast, that they need that
   service, and that nothing happened. No dead clicks and no fake success. */
import { toast } from 'sonner';
import { Facts } from '@/components/app/Facts';
import { PageHeader } from '@/components/app/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFigures } from '@/lib/data-mode';
import { NARROW_PAGE } from './page';
import { usePatient } from './PatientProvider';
import { UrgentLine } from './UrgentLine';

const SECTION = 'text-xl leading-[1.3] font-semibold tracking-[-.02em]';

const notInPrototype = (description: string) => toast('Not in the prototype', { description });

export function Account() {
  const { account, identityVerified, saved, consent, setConsent, card } = usePatient();
  const { shown } = useFigures();

  return (
    <div data-screen="account" className={NARROW_PAGE}>
      <PageHeader title="Account" />
      <div className="grid gap-10">
        <section aria-labelledby="you-title" className="grid gap-3">
          <h2 id="you-title" className={SECTION}>You</h2>
          <Facts
            items={[
              ['Reference', account.ref],
              ['Email', account.email],
              ['Member since', shown(account.memberSince)],
              ['Available in', 'England only'],
            ]}
          />
        </section>

        <section aria-labelledby="identity-title" className="grid gap-3">
          <h2 id="identity-title" className={SECTION}>Identity</h2>
          <Card size="sm">
            <CardContent className="flex items-center justify-between gap-4">
              <span className="font-semibold">Photo ID check</span>
              <Badge variant={identityVerified ? 'success' : 'secondary'}>{identityVerified ? 'Verified' : 'Not yet checked'}</Badge>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="nhs-title" className="grid gap-3">
          <h2 id="nhs-title" className={SECTION}>Your NHS GP</h2>
          <p className="text-body text-ink-2">
            A summary of each consultation is sent to your NHS GP when you allow it. Without it, a GP may be unable to prescribe some treatments safely.
          </p>
          <Card size="sm">
            <CardContent className="grid gap-4">
              <div className="min-w-0">
                <p className="font-semibold">{saved?.practice ?? 'No practice saved'}</p>
                <p className="text-fine text-ink-2">{saved ? saved.postcode : 'You’ll be asked for it when you book.'}</p>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-rule pt-4">
                <div className="min-w-0">
                  <Label htmlFor="share-summaries">Share summaries</Label>
                  <p aria-live="polite" className="mt-1 text-fine text-ink-2">
                    {consent ? 'Each consultation summary is sent here.' : 'Nothing is sent. A GP may be unable to prescribe some treatments without your records.'}
                  </p>
                </div>
                <Switch id="share-summaries" checked={consent} onCheckedChange={setConsent} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="payment-title" className="grid gap-3">
          <h2 id="payment-title" className={SECTION}>Payment</h2>
          <Card size="sm">
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold">{card ? `${card.brand} ending ${card.last4}` : 'No card saved'}</p>
                <p className="text-fine text-ink-2">Held when you confirm a request. Only taken when a GP accepts your consultation.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => notInPrototype('Replacing a card needs the live payment service. Nothing was changed.')}
              >
                {card ? 'Replace' : 'Add a card'}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="data-title" className="grid gap-3">
          <h2 id="data-title" className={SECTION}>Your data</h2>
          <p className="text-body text-ink-2">We hold your email, your consultation summaries and your payment receipts. We never hold your card number.</p>
          <Card size="sm">
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">Download everything we hold</p>
                  <p className="text-fine text-ink-2">A single file, emailed to you.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => notInPrototype('The export needs the live service. Nothing was sent.')}>
                  Request
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-rule pt-4">
                <div className="min-w-0">
                  <p className="font-semibold">Delete your account</p>
                  <p className="text-fine text-ink-2">Clinical records are kept for the period the law requires. Everything else goes.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => notInPrototype('Deleting an account needs the live service. Nothing was deleted.')}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <UrgentLine variant="band" />
      </div>
    </div>
  );
}
