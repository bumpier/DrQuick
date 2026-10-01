'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestLink, type LinkState } from '../actions';

const INITIAL: LinkState = { error: null, sent: false, email: '' };

// The answer never says whether the address has signed up: the same sentence
// follows every valid address, so the form cannot be used to find out who has.
export function RegisterForm({ minutes }: { minutes: number }) {
  const [state, action, pending] = useActionState(requestLink, INITIAL);

  if (state.sent) {
    return (
      <div role="status" className="grid gap-3 rounded-xl bg-lime-wash p-5 text-body">
        <p className="font-semibold">Check your inbox.</p>
        <p>
          If {state.email} has signed up as a GP, a link is on its way. It works once and for {minutes} minutes.
        </p>
        <p className="text-ink-2">
          Not signed up yet?{' '}
          <Link href="/?role=gp#gp-join" className="font-semibold text-primary-ink">Apply to consult</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid max-w-none gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email}
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'link-error' : undefined} />
      </div>
      <p id="link-error" role="alert" aria-live="polite" className="min-h-[1.5em] text-body font-semibold text-error">
        {state.error}
      </p>
      <Button type="submit" size="lg" aria-busy={pending || undefined} disabled={pending}>
        {pending ? 'Sending…' : 'Email me a link'}
      </Button>
    </form>
  );
}
