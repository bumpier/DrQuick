'use client';

/* The Uber home: one thing to do, as large as it can be. The hero card is
   the page's one dark fill and its only primary action. While a consultation
   is live the card is the way back to it instead, so a patient who wandered
   off mid-queue can never abandon a hold by starting again. No price appears
   here: a price is quoted for a request, and a dynamic figure on a page that
   can be screenshotted would read as "the price". */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClockIcon, PillIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { StatTile } from '@/components/app/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { waitEstimate } from '@/lib/booking';
import { bookingHref, isLive } from '@/lib/booking-flow';
import { useFigures } from '@/lib/data-mode';
import { FLOOR } from '@/lib/fixtures';
import { ordinal } from '@/lib/format';
import { formatEta } from '@/lib/live';
import { useBooking } from './BookingProvider';
import { ConsultRow } from './ConsultRow';
import { PAGE } from './page';
import { usePatient } from './PatientProvider';
import { UrgentLine } from './UrgentLine';

function ResumeCard() {
  const { state } = useBooking();
  const gp = state.gp?.ref ?? 'Your GP';
  const resume = state.screen === 'finding'
    ? { title: 'Finding your GP', body: `${ordinal(state.position)} in the queue, ${formatEta(state.etaSeconds)}.`, action: 'Back to your request' }
    : state.screen === 'ready'
      ? { title: 'Your GP is ready', body: `${gp} has accepted your consultation and is waiting for you.`, action: 'Go to your GP' }
      : state.screen === 'call'
        ? { title: 'You’re in a consultation', body: `Your call with ${gp} is still open.`, action: 'Back to your call' }
        : { title: 'Your outcome is ready', body: `${gp} has finished your consultation.`, action: 'See your outcome' };
  return (
    <Card variant="band" data-slot="resume-card" className="band-grid" data-reveal>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-2xl">{resume.title}</CardTitle>
        <CardDescription>{resume.body}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild size="lg" className="min-h-13 w-full">
          <Link href={bookingHref(state.screen)}>{resume.action}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function StartCard() {
  const { act } = useBooking();
  const { saved } = usePatient();
  const { seeded, shown } = useFigures();
  const router = useRouter();
  const start = () => {
    act({ type: 'start', prefill: saved });
    router.push(bookingHref('symptoms') + window.location.search);
  };
  return (
    <Card variant="band" data-slot="start-card" className="band-grid" data-reveal>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-2xl">See a GP in minutes</CardTitle>
        <CardDescription>A video consultation with a GMC-registered GP. Your price is shown in full before you book.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <StatTile size="sm" value={shown(waitEstimate(FLOOR).etaSeconds, formatEta)} label="Estimated wait" />
        <span className="pb-0.5 text-fine text-band-muted">{seeded ? 'GPs online now' : 'Not live yet'}</span>
      </CardContent>
      <CardFooter>
        <Button size="lg" className="min-h-13 w-full" onClick={start}>See a GP now</Button>
      </CardFooter>
    </Card>
  );
}

export function PatientHome() {
  const { state } = useBooking();
  const { history, todos } = usePatient();
  const { seeded } = useFigures();
  const live = isLive(state);

  return (
    <div data-screen="home" className={PAGE}>
      <h1 data-reveal tabIndex={-1} className="mb-6 text-headline max-phone:text-headline-sm">{seeded ? 'Welcome back' : 'Welcome'}</h1>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" data-stagger>
        <div className="grid gap-6">
          {live ? <ResumeCard /> : <StartCard />}
          <UrgentLine variant="band" />
        </div>
        <div className="grid gap-6">
          {todos.length > 0 && (
            <section aria-labelledby="todo-title" className="grid gap-3" data-reveal>
              <h2 id="todo-title" className="text-xl leading-[1.3] font-semibold tracking-[-.02em]">What needs you</h2>
              <ul className="grid gap-2">
                {todos.map((todo) => (
                  <li key={todo.id} data-tone={todo.tone} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-card">
                    {todo.id === 'prescription'
                      ? <PillIcon strokeWidth={2} aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-ink" />
                      : <ClockIcon strokeWidth={2} aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-2" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{todo.title}</p>
                      <p className="text-fine text-ink-2">{todo.note}</p>
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={todo.action.href}>{todo.action.label}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Card data-reveal>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>Recent consultations</CardTitle>
              {history.length > 0 && (
                <CardAction>
                  <Button asChild size="sm" variant="ghost"><Link href="/patient/consultations">See all</Link></Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState>No consultations yet. Your first one will appear here.</EmptyState>
              ) : (
                <ul className="divide-y divide-rule">
                  {history.slice(0, 3).map((row) => <li key={row.id}><ConsultRow consultation={row} /></li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
