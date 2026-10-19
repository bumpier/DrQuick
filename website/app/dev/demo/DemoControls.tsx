'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const WINDOWS = [
  { name: 'Website', href: '/' },
  { name: 'Patient app', href: '/patient?data=seeded' },
  { name: 'Doctor portal', href: '/doctor' },
] as const;

const STEPS = [
  'Reset.',
  'Website: the GP page, then switch to Patients.',
  'Patient app: See a GP now, through to Request a GP.',
  'Doctor portal: sign in (prefilled), Go online. The offer appears.',
  'Doctor: Accept.',
  'Patient: Join the call.',
  'Doctor: Start video; both show the lock.',
  'Doctor: Complete consultation; the patient sees the outcome.',
  'Doctor: Earnings.',
];

const LABEL: Record<string, string> = {
  offline: 'Doctor offline',
  online: 'Doctor online, waiting',
  offer: 'Offer showing',
  consultation: 'In a consultation',
  resting: 'Consultation finished',
};

export function DemoControls({ signOut = false }: { signOut?: boolean }) {
  const [doctor, setDoctor] = useState<string | null>(null);
  const [reset, setReset] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/dev/demo/status', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setDoctor(((await res.json()) as { doctor: string }).doctor);
    } catch {
      setDoctor(null);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const timer = setInterval(poll, 3000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [poll]);

  async function doReset() {
    if (!window.confirm('Reset the demo? Anything live is ended.')) return;
    setReset('working');
    try {
      const res = await fetch('/dev/demo/reset', { method: 'POST' });
      setReset(res.ok ? 'done' : 'failed');
    } catch {
      setReset('failed');
    }
    void poll();
  }

  // A fetch, not a form post: the page's CSP has form-action 'none'.
  async function doSignOut() {
    try {
      await fetch('/dev/demo/sign-out', { method: 'POST' });
    } finally {
      window.location.assign('/demo-access');
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-4xl text-ink">Demo</h1>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p role="status" className="text-label font-bold text-ink">
            {doctor ? LABEL[doctor] ?? doctor : 'Status unavailable'}
          </p>
          <div className="flex items-center gap-4">
            <span role="status" className="text-fine text-ink-2">
              {reset === 'done' ? 'Reset done' : reset === 'failed' ? 'Reset failed' : ''}
            </span>
            <Button variant="secondary" onClick={doReset} disabled={reset === 'working'} aria-busy={reset === 'working'}>
              <RotateCcw strokeWidth={2} aria-hidden="true" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {reset === 'done' && <p className="text-fine text-ink-2">Reopen the patient and doctor windows from here.</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {WINDOWS.map((w) => (
          <Button key={w.name} asChild size="lg" className="h-24 text-body">
            <a href={w.href} target="_blank" rel="noreferrer">
              {w.name}
              <ExternalLink strokeWidth={2} aria-hidden="true" />
            </a>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-body text-ink">
            {STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </CardContent>
      </Card>

      {signOut && (
        <Button variant="link" onClick={doSignOut} className="h-auto self-start p-0 text-fine text-ink-2">
          Sign out of the demo
        </Button>
      )}
    </main>
  );
}
