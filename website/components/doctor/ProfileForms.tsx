'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { changePasswordAction, saveProfileAction } from '@/app/doctor/(portal)/profile/actions';
import {
  BIO_MAX, LANGUAGES_MAX, normaliseProfile, profileErrors, type Profile, type ProfileErrors, type ProfileField,
} from '@/lib/doctor/profile-rules';

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error
        ? <p id={`${id}-error`} role="alert" className="text-fine font-semibold text-error">{error}</p>
        : hint && <p id={`${id}-hint`} className="text-fine text-ink-2">{hint}</p>}
    </div>
  );
}

const describedBy = (id: string, error: string | undefined, hint: boolean) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function ProfileForm({ initial }: { initial: Profile }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [pending, start] = useTransition();
  const dirty = (Object.keys(values) as ProfileField[]).some((k) => values[k] !== saved[k]);

  const set = (field: ProfileField) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = () => {
    const tidy = normaliseProfile(values);
    const found = profileErrors(tidy);
    if (Object.keys(found).length > 0) { setErrors(found); return; }
    start(async () => {
      const result = await saveProfileAction(tidy);
      if (result.ok) { setValues(tidy); setSaved(tidy); toast.success(result.message ?? 'Saved.'); }
      else { setErrors(result.fieldErrors ?? {}); toast.error(result.error); }
    });
  };

  return (
    <form className="grid max-w-none gap-5" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field id="name" label="Full name" hint="As it appears on the GMC register." error={errors.name}>
        <Input id="name" autoComplete="name" value={values.name} onChange={set('name')}
          aria-invalid={errors.name ? true : undefined} aria-describedby={describedBy('name', errors.name, true)} />
      </Field>
      <Field id="mobile" label="Mobile" hint="For the team to reach you. Patients never see it." error={errors.mobile}>
        <Input id="mobile" type="tel" autoComplete="tel" inputMode="tel" value={values.mobile} onChange={set('mobile')}
          aria-invalid={errors.mobile ? true : undefined} aria-describedby={describedBy('mobile', errors.mobile, true)} />
      </Field>
      <Field id="languages" label="Languages you consult in" hint="For example: English, Urdu." error={errors.languages}>
        <Input id="languages" maxLength={LANGUAGES_MAX} value={values.languages} onChange={set('languages')}
          aria-invalid={errors.languages ? true : undefined} aria-describedby={describedBy('languages', errors.languages, true)} />
      </Field>
      <Field id="bio" label="About you" hint={`${values.bio.length} of ${BIO_MAX} characters.`} error={errors.bio}>
        <Textarea id="bio" rows={5} maxLength={BIO_MAX} value={values.bio} onChange={set('bio')}
          aria-invalid={errors.bio ? true : undefined} aria-describedby={describedBy('bio', errors.bio, true)} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !dirty} aria-busy={pending || undefined}>Save profile</Button>
        <span className="text-fine text-ink-2">{dirty ? 'Unsaved changes' : 'Saved'}</span>
      </div>
    </form>
  );
}

const EMPTY = { current: '', next: '', confirm: '' };

export function PasswordForm({ minLength }: { minLength: number }) {
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (field: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setError(null);
  };

  const submit = () => start(async () => {
    const result = await changePasswordAction(values.current, values.next, values.confirm);
    if (result.ok) { setValues(EMPTY); toast.success(result.message ?? 'Password changed.'); }
    else setError(result.error);
  });

  const filled = values.current && values.next && values.confirm;

  return (
    <form className="grid max-w-none gap-5" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field id="current-password" label="Current password">
        <Input id="current-password" type="password" autoComplete="current-password" value={values.current} onChange={set('current')} />
      </Field>
      <Field id="new-password" label="New password" hint={`At least ${minLength} characters.`}>
        <Input id="new-password" type="password" autoComplete="new-password" value={values.next} onChange={set('next')}
          aria-describedby="new-password-hint" />
      </Field>
      <Field id="confirm-password" label="Type it again">
        <Input id="confirm-password" type="password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />
      </Field>
      <p role="alert" aria-live="polite" className="min-h-[1.5em] text-body font-semibold text-error">{error}</p>
      <div>
        <Button type="submit" variant="secondary" disabled={pending || !filled} aria-busy={pending || undefined}>Change password</Button>
      </div>
    </form>
  );
}
