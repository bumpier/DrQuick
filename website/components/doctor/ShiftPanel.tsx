'use client';
import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { Countdown } from '@/components/app/Countdown';
import { Facts } from '@/components/app/Facts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  acceptAction, backOnlineAction, completeAction, declineAction, goOfflineAction, goOnlineAction, noShowAction,
  type ShiftActionResult,
} from '@/app/doctor/(portal)/shift-actions';
import type { ShiftState } from '@/lib/doctor/shift';
import { gbp } from '@/lib/money';
import { useElapsed, useShift } from './ShiftProvider';

type Of<K extends ShiftState['kind']> = Extract<ShiftState, { kind: K }>;

const pad = (n: number) => String(n).padStart(2, '0');
// "04:07" for a consultation; "1 h 12 min" for time online.
const clock = (ms: number) => `${pad(Math.floor(ms / 60_000))}:${pad(Math.floor(ms / 1000) % 60)}`;
function span(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const UNREACHED = 'That did not go through. Check your connection, refresh the page and try again.';

const CONSENT: Record<string, string> = {
  true: 'Shared with you',
  false: 'Not shared. You may be unable to prescribe some treatments.',
  null: 'Not stated',
};

function Panel({ title, description, children, tone }: {
  title: string; description?: ReactNode; children?: ReactNode; tone?: 'wash' | 'default';
}) {
  return (
    <Card variant={tone ?? 'default'} data-slot="shift-panel">
      <CardHeader>
        {/* The class sets the size: a bare h2 takes the landing page's scale. */}
        <CardTitle><h2 className="text-headline-sm">{title}</h2></CardTitle>
        {description && <CardDescription className="text-body">{description}</CardDescription>}
      </CardHeader>
      {children && <CardContent className="grid gap-5">{children}</CardContent>}
    </Card>
  );
}

// The one control that matters on shift, in the state the server says the
// doctor is in. One primary action per state; ending a consultation asks first.
export function ShiftPanel() {
  const { state, at, apply } = useShift();
  const router = useRouter();
  const [pending, start] = useTransition();
  const elapsed = useElapsed(at, state.kind === 'offer' || state.kind === 'consultation' || state.kind === 'idle');

  const settle = (result: ShiftActionResult) => {
    apply(result.state);
    return result;
  };
  // A click that never reaches the server (the network dropped, or the page is
  // from before a deploy) is said in words here. Left to throw, it would land
  // in the framework's error screen, which replaces the whole portal and stops
  // the poll with it.
  const run = (action: () => Promise<ShiftActionResult>) => start(async () => {
    try {
      const result = settle(await action());
      if (!result.ok) toast.error(result.error);
    } catch {
      toast.error(UNREACHED);
    }
  });
  // Ending a consultation changes the figures on the page, which the server drew.
  const end = (action: () => Promise<ShiftActionResult>) => async () => {
    try {
      const result = settle(await action());
      router.refresh();
      return result;
    } catch {
      return { ok: false as const, error: UNREACHED };
    }
  };

  const busy = pending || undefined;
  const offline = (
    <Button variant="secondary" size="lg" disabled={pending} aria-busy={busy} onClick={() => run(goOfflineAction)}>Go offline</Button>
  );

  switch (state.kind) {
    case 'unavailable':
      return state.reason === 'paused'
        ? <Panel tone="wash" title="Your account is paused" description="Contact the team to go back online." />
        : (
          <Panel
            tone="wash"
            title="Your application is being reviewed"
            description="You can go online once the team has approved your account. We will email you when that happens."
          />
        );

    case 'offline':
      return (
        <Panel title="You’re offline" description="Go online to be offered consultations. You are only matched while you are online.">
          <div><Button size="lg" disabled={pending} aria-busy={busy} onClick={() => run(goOnlineAction)}>Go online</Button></div>
        </Panel>
      );

    case 'idle':
      return (
        <Panel
          tone="wash"
          title="You’re online"
          description="Waiting for a patient. Keep this tab open and in view: an offer appears here with a countdown."
        >
          <p className="text-body text-ink-2">Online for {span(state.onlineMs + elapsed)}.</p>
          <div>{offline}</div>
        </Panel>
      );

    case 'resting':
      return (
        <Panel
          title={state.reason === 'missed' ? 'You missed an offer' : 'Consultation finished'}
          description={state.reason === 'missed'
            ? 'It has gone to another GP. You will not be offered another until you are back online.'
            : 'Take the time you need. You will not be offered another until you are back online.'}
        >
          <div className="flex flex-wrap gap-3">
            <Button size="lg" disabled={pending} aria-busy={busy} onClick={() => run(backOnlineAction)}>Back online</Button>
            {offline}
          </div>
        </Panel>
      );

    case 'offer':
      return <Offer offer={state} elapsed={elapsed} pending={pending} run={run} />;

    case 'consultation':
      return (
        <Panel title="Consultation in progress" description={`You are paid ${gbp(state.feePence)} for this consultation.`}>
          <p aria-label="Time in consultation" className="font-display text-4xl font-bold leading-none tracking-[-.03em] tabular-nums">
            {clock(state.elapsedMs + elapsed)}
          </p>
          <Facts items={[['Reason', state.reason ?? 'Not stated'], ['Age', state.ageBand ?? 'Not stated']]} />
          <div className="flex flex-wrap gap-3">
            <ConfirmAction
              trigger={<Button size="lg">Complete consultation</Button>}
              title="Complete this consultation?"
              description="It will be recorded as completed and added to your earnings."
              confirmLabel="Complete"
              run={end(completeAction)}
            />
            <ConfirmAction
              trigger={<Button variant="secondary" size="lg">Patient did not arrive</Button>}
              title="Record a no-show?"
              description="The consultation will end as a no-show. A no-show is not paid."
              confirmLabel="Record no-show"
              run={end(noShowAction)}
            />
          </div>
        </Panel>
      );
  }
}

function Offer({ offer, elapsed, pending, run }: {
  offer: Of<'offer'>; elapsed: number; pending: boolean; run: (action: () => Promise<ShiftActionResult>) => void;
}) {
  const seconds = Math.ceil(Math.max(0, offer.remainingMs - elapsed) / 1000);
  const over = seconds <= 0;
  return (
    <Panel title="A patient is waiting" description={`You are paid ${gbp(offer.feePence)} for this consultation.`}>
      <Countdown remaining={Math.min(offer.windowSeconds, seconds)} total={offer.windowSeconds} />
      <Facts
        items={[
          ['Reason', offer.reason ?? 'Not stated'],
          ['Age', offer.ageBand ?? 'Not stated'],
          ['NHS record', CONSENT[String(offer.recordConsent)]],
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Button size="lg" disabled={pending || over} aria-busy={pending || undefined} onClick={() => run(() => acceptAction(offer.offerId))}>
          Accept
        </Button>
        <Button variant="secondary" size="lg" disabled={pending || over} onClick={() => run(() => declineAction(offer.offerId))}>
          Decline
        </Button>
      </div>
    </Panel>
  );
}
