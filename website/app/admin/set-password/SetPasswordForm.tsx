'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setPassword, type SetPasswordState } from '../actions';

const INITIAL: SetPasswordState = { error: null };

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setPassword, INITIAL);
  return (
    <form action={action} className="grid max-w-none gap-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'password-error' : undefined} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Type it again</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'password-error' : undefined} />
      </div>
      <p id="password-error" role="alert" aria-live="polite" className="min-h-[1.5em] text-body font-semibold text-error">
        {state.error}
      </p>
      <Button type="submit" size="lg" aria-busy={pending || undefined} disabled={pending}>
        {pending ? 'Saving…' : 'Save and sign in'}
      </Button>
    </form>
  );
}
