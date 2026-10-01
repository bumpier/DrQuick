'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAttribution, onFirstView, track } from '@/lib/analytics/track';
import { GP_FEE_LABEL, GP_FEE_REFUND } from '@/lib/gp-fee';
import {
  GP_MESSAGES, MAX_EMAIL, MAX_NAME,
  firstInvalidField, normaliseGpSignup,
  type GpField,
} from '@/lib/gp-signup';

type Status = { kind: 'ok' | 'err'; message: string } | null;

// Which control opened the sign-up: the hero, the closing band, the nav, or a
// link to #gp-join (another page's button, or the way back from Stripe).
export type GpSignupSource = 'hero-gp' | 'recap-gp' | 'nav-gp' | 'link-gp';

const MESSAGES = {
  rateLimited: 'That is a few too many tries. Give it a couple of minutes.',
  unreachable: "Couldn't reach the server — try again in a moment.",
  paymentsOff: 'Sign-up payments aren’t switched on yet. Nothing was taken. Try again soon.',
  checkoutFailed: 'We couldn’t open the payment page. Nothing was taken. Try again in a moment.',
  alreadyPaid: 'This email address has already signed up and paid. We’ll be in touch before we open.',
} as const;

const toStripe = (url: string) => window.location.assign(url);

// The GP sign-up, inside the pop-up (components/GpSignupDialog.tsx). Four
// fields, the fee, and one button that hands over to Stripe: a doctor is
// applying, not subscribing, and the register check needs a name and a GMC
// number to run against. The details are stored as an unpaid application and
// the browser is sent to Stripe's hosted payment page; the fee is recorded as
// paid by the server when Stripe says so, never by this form.
//
// The honeypot, the single live status region and the replayed entry animation
// are the same grammar as WaitlistForm, so the page still has one way of
// behaving.
export function GpSignupForm({ source, inputId, onRedirect = toStripe }: {
  source: GpSignupSource;
  // The id of the FIRST field; the other three derive from it.
  inputId: string;
  // Where a successful submit sends the browser. Replaceable so a test can
  // watch the hand-over without navigating.
  onRedirect?: (url: string) => void;
}) {
  const refs: Record<GpField, React.RefObject<HTMLInputElement | null>> = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    mobile: useRef<HTMLInputElement>(null),
    gmc: useRef<HTMLInputElement>(null),
  };
  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);
  const hpRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState<GpField | null>(null);

  const statusId = `${inputId}-status`;
  const feeId = `${inputId}-fee`;
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

  // Funnel events for the analytics (lib/analytics/track.ts); each is a no-op
  // without analytics consent. Field names and error codes only, never values.
  const t = (type: Parameters<typeof track>[0], props: Record<string, string | boolean> = {}) =>
    track(type, { form: source, role: 'gp', ...props });
  useEffect(() => onFirstView(formRef.current, () => track('form_view', { form: source, role: 'gp' })), [source]);
  const onInput = (e: React.FormEvent<HTMLFormElement>) => {
    if (startedRef.current || (e.target as HTMLInputElement).name === 'company') return;
    startedRef.current = true;
    t('form_start');
  };
  const onFocus = (e: React.FocusEvent<HTMLFormElement>) => {
    const el: EventTarget = e.target;
    if (el instanceof HTMLInputElement && el.name && el.name !== 'company') t('field_focus', { field: el.name });
  };

  const fail = (field: GpField, message = GP_MESSAGES[field], from: 'client' | 'server' = 'client') => {
    t('field_error', { field, error: `invalid_${field}`, from });
    say({ kind: 'err', message });
    setInvalid(field);
    refs[field].current?.focus();
  };

  // A failure that is not about a field: say it, and leave the form usable.
  const stop = (error: string, message: string) => {
    t('form_fail', { error });
    say({ kind: 'err', message });
    setBusy(false);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
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
    t('form_submit');
    try {
      const res = await fetch('/api/gp-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signup,
          source,
          company: hpRef.current?.value ?? '',
          ...getAttribution(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; url?: string; alreadyPaid?: boolean };

      if (res.status === 429) return stop('rate_limited', MESSAGES.rateLimited);
      if (!res.ok) {
        // The route validates again; if it rejects a field, point at that field
        // rather than showing a generic failure over a form the reader can fix.
        const field = (body.error ?? '').replace(/^invalid_/, '') as GpField;
        if (res.status === 400 && field in GP_MESSAGES) {
          t('form_fail', { error: `invalid_${field}` });
          fail(field, GP_MESSAGES[field], 'server');
          setBusy(false);
          return;
        }
        if (body.error === 'payments_unavailable') return stop('payments_unavailable', MESSAGES.paymentsOff);
        if (body.error === 'checkout_failed') return stop('checkout_failed', MESSAGES.checkoutFailed);
        throw new Error(`http_${res.status}`);
      }

      if (body.alreadyPaid) {
        t('form_success', { already: true });
        say({ kind: 'ok', message: MESSAGES.alreadyPaid });
        statusRef.current?.focus();
        setDone(true);
        return;
      }
      // Only ever a secure address: the page this hands over to takes a card.
      if (!body.url || !/^https:\/\//i.test(body.url)) return stop('checkout_failed', MESSAGES.checkoutFailed);

      // The details are in; what is left happens on Stripe. The button stays
      // busy, because the page is about to be replaced.
      t('form_success', { already: false });
      onRedirect(body.url);
    } catch (err) {
      const code = (err as Error)?.message ?? '';
      stop(code.startsWith('http_') ? code : 'network', MESSAGES.unreachable);
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
      ref={formRef}
      data-role="gp"
      data-source={source}
      noValidate
      className={`mt-6 max-w-none${done ? ' done' : ''}`}
      onSubmit={onSubmit}
      onInput={onInput}
      onFocus={onFocus}
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

        {/* The price, at the moment of deciding: the amount, that it is paid
            once, and how it comes back, directly above the button that leads
            to paying it. */}
        <div className="fee mt-5 rounded-lg bg-lime-wash px-4 py-3.5" id={feeId}>
          <p className="flex items-baseline justify-between gap-4 font-bold">
            <span>Sign-up fee, paid once</span>
            <span className="font-display text-headline-sm font-extrabold tabular-nums">{GP_FEE_LABEL}</span>
          </p>
          <p className="mt-1 text-fine text-ink-2">{GP_FEE_REFUND}</p>
        </div>

        {/* `.btn` stays on the element for the sizing rules in globals.css. */}
        <Button className="btn submit" size="lg" type="submit" disabled={busy} aria-busy={busy || undefined} aria-describedby={feeId}>
          {busy ? 'Opening Stripe…' : 'Continue to payment'}
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
        <p className="note">
          You pay by card on Stripe; Dr Quick never sees your card details. Your details are used to check the GMC register and to contact you about launching.{' '}
          <a href="/privacy" className="font-semibold text-primary-ink underline underline-offset-2">Privacy</a>
        </p>
      </div></div>
    </form>
  );
}
