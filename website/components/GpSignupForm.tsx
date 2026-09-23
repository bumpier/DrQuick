'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GP_MESSAGES, MAX_EMAIL, MAX_NAME,
  firstInvalidField, normaliseGpSignup,
  type GpField,
} from '@/lib/gp-signup';

type Status = { kind: 'ok' | 'err'; message: string } | null;

// The GP sign-up. Four fields rather than the patient form's one: a doctor is
// applying, not subscribing, and the register check needs a name and a GMC
// number to run against. Everything else — the honeypot, the single live status
// region, the collapsing capture, the replayed entry animation — is the same
// grammar as WaitlistForm, so the page still has one way of behaving.
export function GpSignupForm({ source, cta, inputId, reveal }: {
  source: 'hero-gp' | 'recap-gp';
  cta: string;
  // The id of the FIRST field: the nav CTA jumps here, so it must stay the top
  // of the form. The other three derive from it.
  inputId: string;
  reveal?: 'load' | '';
}) {
  const refs: Record<GpField, React.RefObject<HTMLInputElement | null>> = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    mobile: useRef<HTMLInputElement>(null),
    gmc: useRef<HTMLInputElement>(null),
  };
  const hpRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState<GpField | null>(null);

  const statusId = `${inputId}-status`;
  const idFor = (field: GpField) => (field === 'name' ? inputId : `${inputId}-${field}`);

  // One identity across messages so the live region announces the change. The
  // entry animation replays the way the flat page did it: drop the state class,
  // force a reflow, put it back. React never writes these two classes.
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

  const fail = (field: GpField, message = GP_MESSAGES[field]) => {
    say({ kind: 'err', message });
    setInvalid(field);
    refs[field].current?.focus();
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    say(null);
    setInvalid(null);

    const signup = normaliseGpSignup({
      name: refs.name.current?.value,
      email: refs.email.current?.value,
      mobile: refs.mobile.current?.value,
      gmc: refs.gmc.current?.value,
    });

    // Focus lands on the topmost problem, and the live region names it — with
    // four fields, "which one" is the whole message.
    const bad = firstInvalidField(signup);
    if (bad) return fail(bad);

    setBusy(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signup,
          role: 'gp',
          source,
          company: hpRef.current?.value ?? '',
        }),
      });
      if (res.status === 429) {
        say({ kind: 'err', message: 'That is a few too many tries. Give it a couple of minutes.' });
        setInvalid('email');
        setBusy(false);
        return;
      }
      if (!res.ok) {
        // The route validates again; if it rejects a field, point at that field
        // rather than showing a generic failure over a form the reader can fix.
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const field = (body.error ?? '').replace(/^invalid_/, '') as GpField;
        if (res.status === 400 && field in GP_MESSAGES) {
          fail(field);
          setBusy(false);
          return;
        }
        throw new Error(String(res.status));
      }
      const data = (await res.json().catch(() => ({}))) as { alreadyJoined?: boolean };
      say({
        kind: 'ok',
        message: data.alreadyJoined
          ? "You're already signed up. We'll be in touch before we open."
          : "You're signed up. We check your GMC registration, then get in touch before we open.",
      });
      statusRef.current?.focus();
      setDone(true);
    } catch {
      say({ kind: 'err', message: "Couldn't reach the server — try again in a moment." });
      setInvalid('email');
      setBusy(false);
    }
  }

  const field = (
    f: GpField,
    label: string,
    props: React.ComponentProps<'input'>,
  ) => (
    <div className="field">
      <Label htmlFor={idFor(f)}>{label}</Label>
      <Input
        ref={refs[f]}
        id={idFor(f)}
        name={f}
        aria-describedby={statusId}
        aria-invalid={invalid === f || undefined}
        required
        {...props}
      />
    </div>
  );

  return (
    <form
      data-role="gp"
      data-source={source}
      data-reveal={reveal}
      noValidate
      className={done ? 'done' : undefined}
      onSubmit={onSubmit}
    >
      <div className="capture"><div>
        <div className="fields">
          {field('name', 'Full name', {
            type: 'text', autoComplete: 'name', maxLength: MAX_NAME, placeholder: 'Dr Jane Okafor',
          })}
          {field('email', 'Email', {
            type: 'email', autoComplete: 'email', maxLength: MAX_EMAIL, placeholder: 'jane@example.com',
          })}
          {field('mobile', 'Mobile number', {
            type: 'tel', autoComplete: 'tel', inputMode: 'tel', maxLength: 20, placeholder: '07700 900123',
          })}
          {field('gmc', 'GMC number', {
            // Not autofillable: no browser holds it, and guessing risks pasting
            // the wrong seven digits into the one field we verify against.
            type: 'text', autoComplete: 'off', inputMode: 'numeric', maxLength: 9, placeholder: '7 digits',
          })}
        </div>
        <input ref={hpRef} className="hp" type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        {/* `.btn` stays on the element for the sizing rules in globals.css. */}
        <Button className="btn submit" size="lg" type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? 'Signing up…' : cta}
        </Button>
      </div></div>
      <p ref={statusRef} className="status" id={statusId} role="status" aria-live="polite" tabIndex={-1}>
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
      <div className="capture"><div>
        <p className="note">Used to verify you on the GMC register and to contact you about launching. Nothing else.</p>
      </div></div>
    </form>
  );
}
