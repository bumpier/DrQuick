'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { enterDemo, type DemoAccessState } from './actions';

const INITIAL: DemoAccessState = { error: null };

// One field and one button. `next` is where the visitor was going, already
// checked to be a path on this site; the action checks it again.
export function DemoAccessForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(enterDemo, INITIAL);
  return (
    <form action={action} className="grid max-w-none gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-2">
        <Label htmlFor="passcode">Passcode</Label>
        <Input id="passcode" name="passcode" type="password" autoComplete="current-password" required
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'passcode-error' : undefined} />
      </div>
      <p id="passcode-error" role="alert" aria-live="polite" className="text-body font-semibold text-error empty:sr-only">
        {state.error}
      </p>
      <Button type="submit" size="lg" aria-busy={pending || undefined} disabled={pending}>
        {pending ? 'Checking…' : 'Enter demo'}
      </Button>
    </form>
  );
}
