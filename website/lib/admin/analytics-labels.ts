// Human names for the analytics contract's machine names (lib/analytics/ingest.ts):
// landing sections, forms, form fields and error codes. Pure; shared by the
// engagement page, the funnels and the visitor timeline so one section is
// never called two things.
import { GP_SECTIONS, PATIENT_SECTIONS } from '@/lib/analytics/sections';

export const SECTION_LABELS: Record<string, string> = {
  'patient-hero': 'Hero',
  'patient-urgent': '999 band',
  'patient-how-it-works': 'How it works',
  'patient-covers': 'What it covers',
  'patient-price': 'Price',
  'patient-faq': 'FAQ',
  'patient-closing': 'Closing sign-up',
  'gp-hero': 'GP hero',
  'gp-shift': 'How a shift works',
  'gp-scope': 'What we do and don’t',
  'gp-pay': 'What you’re paid',
  'gp-faq': 'GP FAQ',
  'gp-closing': 'GP closing sign-up',
};
export const sectionLabel = (s: string) => SECTION_LABELS[s] ?? s;

export type Mode = 'patient' | 'gp';
export const sectionsFor = (mode: Mode): readonly string[] => (mode === 'gp' ? GP_SECTIONS : PATIENT_SECTIONS);

export const FORM_LABELS: Record<string, string> = {
  hero: 'patient form at the top',
  recap: 'patient form at the bottom',
  'hero-gp': 'GP form at the top',
  'recap-gp': 'GP form at the bottom',
};
// "the GP form" / "the patient form" — the short name used in sentences.
export function formName(form: unknown, role?: unknown): string {
  if (typeof form === 'string' && form.endsWith('-gp')) return 'the GP form';
  if (role === 'gp') return 'the GP form';
  if (typeof form === 'string' && (form === 'hero' || form === 'recap')) return 'the patient form';
  return 'the form';
}

export const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  name: 'Name',
  mobile: 'Mobile',
  gmc: 'GMC number',
};
export const fieldLabel = (f: unknown) => (typeof f === 'string' ? FIELD_LABELS[f] ?? f : 'a field');

// 'invalid_gmc' → 'invalid'; 'missing_email' → 'missing'; 'rate_limited' → 'rate limited'.
export function errorLabel(code: unknown): string {
  if (typeof code !== 'string' || !code) return 'unknown error';
  if (code.startsWith('invalid_')) return 'invalid';
  if (code.startsWith('missing_')) return 'missing';
  if (code.startsWith('http_')) return `server error ${code.slice(5)}`;
  return code.replace(/_/g, ' ');
}

export const DEVICE_BUCKETS = ['desktop', 'tablet', 'mobile'] as const;
export type DeviceBucket = (typeof DEVICE_BUCKETS)[number];
export const DEVICE_LABELS: Record<DeviceBucket, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };

// "1m 05s", "45s", "2h 03m" — for engaged time.
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
