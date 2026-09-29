'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAttribution, onFirstView, track } from '@/lib/analytics/track';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = { kind: 'ok' | 'err'; message: string } | null;

export function WaitlistForm({ role, source, cta, inputId, reveal }: {
  role: 'patient' | 'gp';
  source: 'hero' | 'recap' | 'hero-gp' | 'recap-gp';
  cta: string;
  inputId: string;
  reveal?: 'load' | '';
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const busyLabel = role === 'gp' ? 'Registering…' : 'Joining…';

  // Funnel events for the analytics (lib/analytics/track.ts). Each is a no-op
  // without analytics consent. `form` is the source, so the four captures on
  // the page stay distinguishable.
  const t = (type: Parameters<typeof track>[0], props: Record<string, string | boolean> = {}) =>
    track(type, { form: source, role, ...props });
  useEffect(() => onFirstView(formRef.current, () => track('form_view', { form: source, role })), [role, source]);
  const onInput = (e: React.FormEvent<HTMLFormElement>) => {
    if (startedRef.current || (e.target as HTMLInputElement).name === 'company') return;
    startedRef.current = true;
    t('form_start');
  };
  const onFocus = (e: React.FocusEvent<HTMLFormElement>) => {
    const el: EventTarget = e.target;
    if (el instanceof HTMLInputElement && el.name && el.name !== 'company') t('field_focus', { field: el.name });
  };

  // The status element keeps one identity across messages so the live region
  // announces text changes. The entry animation replays the way the flat page
  // did it: drop the state class, force a reflow, put it back. React never
  // writes these two classes — className stays the constant "status" — so the
  // imperative toggles and the declarative render cannot fight.
  const say = (next: Status) => {
    const el = statusRef.current;
    if (el) {
      el.classList.remove('ok', 'err');
      if (next) {
        void el.offsetWidth;
        el.classList.add(next.kind);
      }
    }
    setStatus(next);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const email = input.value.trim();
    say(null);
    setInvalid(false);
    const trap = hpRef.current?.value ?? '';
    if (!EMAIL.test(email)) {
      say({ kind: 'err', message: 'Enter a valid email address, like name@example.com.' });
      t('field_error', { field: 'email', error: email ? 'invalid_email' : 'missing_email' });
      setInvalid(true);
      input.focus();
      return;
    }
    setBusy(true);
    t('form_submit');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, source, company: trap, ...getAttribution() }),
      });
      if (res.status === 429) {
        t('form_fail', { error: 'rate_limited' });
        say({ kind: 'err', message: 'That is a few too many tries. Give it a couple of minutes.' });
        setInvalid(true);
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error(`http_${res.status}`);
      const data = (await res.json().catch(() => ({}))) as { alreadyJoined?: boolean };
      t('form_success', { already: Boolean(data.alreadyJoined) });
      const joined = role === 'gp'
        ? "You're on the list. We'll be in touch before we open."
        : "You're on the list. We'll email you the day Dr Quick opens.";
      say({ kind: 'ok', message: data.alreadyJoined ? "You're already on the list. We'll be in touch." : joined });
      statusRef.current?.focus();
      setDone(true); // the button stays disabled inside the collapsing capture, as on the flat page
    } catch (err) {
      const code = (err as Error)?.message ?? '';
      t('form_fail', { error: code.startsWith('http_') ? code : 'network' });
      say({ kind: 'err', message: "Couldn't reach the server — try again in a moment." });
      setInvalid(true);
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      data-role={role}
      data-source={source}
      data-reveal={reveal}
      noValidate
      className={done ? 'done' : undefined}
      onSubmit={onSubmit}
      onInput={onInput}
      onFocus={onFocus}
    >
      <div className="capture"><div><div className="row">
        <Input
          ref={inputRef}
          className="flex-1"
          id={inputId}
          type="email"
          name="email"
          placeholder="Enter your email"
          aria-label="Email address"
          aria-describedby={`${inputId}-status`}
          autoComplete="email"
          required
          aria-invalid={invalid || undefined}
        />
        <input ref={hpRef} className="hp" type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        {/* `.btn` stays on the element for the `.row .btn` sizing rule in globals.css. */}
        <Button className="btn" size="lg" type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? busyLabel : cta}
        </Button>
      </div></div></div>
      <p ref={statusRef} className="status" id={`${inputId}-status`} role="status" aria-live="polite" tabIndex={-1}>
        <svg className="i-ok" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect width="16" height="16" rx="4.5" fill="currentColor" />
          <path d="M4.2 8.4l2.6 2.6L11.8 5.8" stroke="#FFF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <svg className="i-err" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect width="16" height="16" rx="4.5" fill="currentColor" />
          <path d="M8 4.2v4.4" stroke="#FFF" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="8" cy="11.6" r="1.15" fill="#FFF" />
        </svg>
        <span className="status-text">{status?.message ?? ''}</span>
      </p>
      <div className="capture"><div><p className="note">Launch updates only. Unsubscribe anytime.</p></div></div>
    </form>
  );
}
