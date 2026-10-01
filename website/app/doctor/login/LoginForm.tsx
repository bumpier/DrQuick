'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, type SignInState } from '../actions';

const INITIAL: SignInState = { error: null, email: '' };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, INITIAL);
  return (
    <form action={action} className="grid max-w-none gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email}
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'login-error' : undefined} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'login-error' : undefined} />
      </div>
      <p id="login-error" role="alert" aria-live="polite" className="min-h-[1.5em] text-body font-semibold text-error">
        {state.error}
      </p>
      <Button type="submit" size="lg" aria-busy={pending || undefined} disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
