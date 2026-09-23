/* What the dashboard owes a GP before it owes them anything else: which of
   their credentials is about to stop them working, and how long they have.
   Derived from the credential record rather than typed as a second copy —
   an alert that can drift from the record it describes is worse than none. */
import type { CredentialKey, CredentialRecord, CredentialStatus, Credential, GateId } from '@/lib/fixtures';

export type AlertTone = 'blocking' | 'act' | 'watch';
export type CredentialAlert = {
  key: CredentialKey; label: string; status: CredentialStatus; daysRemaining: number | null; tone: AlertTone;
};

export const CREDENTIAL_KEYS = ['gmc', 'licence', 'cct', 'dbs', 'rightToWork', 'indemnity', 'revalidation'] as const satisfies readonly CredentialKey[];

export const CREDENTIAL_LABELS: Record<CredentialKey, string> = {
  gmc: 'GMC registration',
  licence: 'Licence to practise',
  cct: 'CCT / specialist registration',
  dbs: 'DBS check',
  rightToWork: 'Right to work',
  indemnity: 'Indemnity cover',
  revalidation: 'GMC revalidation',
};

// A status pill carries a word, not only a colour, and the word reads as
// English rather than as the fixture's own key.
export const STATUS_LABELS: Record<CredentialStatus, string> = {
  valid: 'Verified', expiring: 'Expiring', expired: 'Expired', pending: 'Pending', rejected: 'Rejected',
};

// Indemnity is the only credential whose lapse is unlawful to work through
// rather than merely non-compliant, so it is the only one that blocks.
const BLOCKING = new Set<CredentialKey>(['indemnity']);

export function credentialAlerts(
  credentials: Partial<Record<CredentialKey, Credential>>,
  { warnWithinDays = 30 }: { warnWithinDays?: number } = {},
): CredentialAlert[] {
  return (Object.entries(credentials) as [CredentialKey, Credential][])
    .map(([key, credential]) => {
      const { status, daysRemaining } = credential;
      const soon = typeof daysRemaining === 'number' && daysRemaining <= warnWithinDays;
      let tone: AlertTone | null = null;
      if (status === 'expired') tone = 'blocking';
      else if (status === 'rejected') tone = 'blocking';   // added for the onboarding statuses; no preview fixture produced one
      else if (status === 'expiring') tone = BLOCKING.has(key) ? 'blocking' : 'act';
      else if (status === 'pending') tone = 'watch';
      else if (soon) tone = 'watch';
      if (!tone) return null;
      return { key, label: CREDENTIAL_LABELS[key] ?? key, status, daysRemaining, tone };
    })
    .filter((alert): alert is CredentialAlert => alert !== null)
    .sort((a, b) => rank(b) - rank(a) || days(a) - days(b));
}

const RANK: Record<AlertTone, number> = { blocking: 3, act: 2, watch: 1 };
const rank = (alert: CredentialAlert) => RANK[alert.tone] ?? 0;
const days = (alert: CredentialAlert) => (typeof alert.daysRemaining === 'number' ? alert.daysRemaining : Infinity);

export function alertSentence(alert: Pick<CredentialAlert, 'label' | 'status'> & { daysRemaining?: number | null }): string {
  if (alert.status === 'expired') return `${alert.label} has expired.`;
  if (alert.status === 'rejected') return `${alert.label} could not be verified.`;
  if (alert.status === 'pending') return `${alert.label} is still being verified.`;
  const d = alert.daysRemaining;
  return `${alert.label} expires in ${d} day${d === 1 ? '' : 's'}.`;
}

/* Which gate, if any, replaces the dashboard. Derived from the same alerts
   the dashboard lists, so a gate and an alert can never disagree. Indemnity
   is a hard legal stop and wins; a rejected check beats a pending one;
   revalidation only ever warns (BLOCKING does not contain it). */
export function gateFor(credentials: CredentialRecord): GateId | null {
  const alerts = credentialAlerts(credentials);
  if (alerts.some((a) => a.key === 'indemnity' && a.status === 'expired')) return 'indemnity-expired';
  if (alerts.some((a) => a.status === 'rejected')) return 'verification-rejected';
  if (alerts.some((a) => a.status === 'pending')) return 'verification-pending';
  if (alerts.some((a) => a.key === 'revalidation')) return 'revalidation-due';
  return null;
}
