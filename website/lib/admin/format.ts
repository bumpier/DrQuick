// Small display helpers shared by the admin pages. Pure.

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
});
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/London' });
const COUNT = new Intl.NumberFormat('en-GB');
const PCT = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });

export const fmtDate = (d: Date | string) => DATE.format(new Date(d));
export const fmtDateTime = (d: Date | string) => DATE_TIME.format(new Date(d));
export const fmtTime = (d: Date | string) => TIME.format(new Date(d));
export const fmtCount = (n: number) => COUNT.format(n);
export const fmtPct = (ratio: number | null) => (ratio === null ? '—' : PCT.format(ratio));

// "3 minutes ago" for the live list and the journey.
export function ago(d: Date | string, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return fmtDate(d);
}

// The host of a referrer URL, without www. Null for anything unparseable.
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url.includes('://') ? url : `https://${url}`).hostname.toLowerCase();
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

// Where a sign-up first came from: the UTM source if the link carried one,
// else the referring site, else Direct. A referrer from our own site is Direct.
export function firstTouchChannel(
  s: { utmSource: string | null; referrer: string | null },
  ownHost: string | null = null,
): string {
  if (s.utmSource) return s.utmSource;
  const host = hostOf(s.referrer);
  if (host && host !== ownHost?.replace(/^www\./, '')) return host;
  return 'Direct';
}

// Percentage change against the previous period; null when there is nothing
// to compare with (a rise from zero is not a percentage).
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export const GP_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  gmc_verified: 'GMC checked',
  onboarding: 'Onboarding',
  active: 'Active',
  rejected: 'Not going ahead',
};
export const PATIENT_STATUS_LABELS: Record<string, string> = {
  subscribed: 'Subscribed',
  unsubscribed: 'Unsubscribed',
};
export const statusLabel = (role: string, status: string) =>
  (role === 'gp' ? GP_STATUS_LABELS : PATIENT_STATUS_LABELS)[status] ?? status;

export const SOURCE_LABELS: Record<string, string> = {
  hero: 'Hero form',
  recap: 'Closing form',
  'hero-gp': 'GP hero form',
  'recap-gp': 'GP closing form',
  landing: 'Landing page',
};
export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;

// The longest note an admin can keep on a sign-up.
export const NOTES_MAX = 5000;
