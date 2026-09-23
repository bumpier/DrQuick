/* What the dashboard owes a GP before it owes them anything else: which of
   their credentials is about to stop them working, and how long they have.
   Derived from the credential record rather than typed as a second copy —
   an alert that can drift from the record it describes is worse than none. */

const LABELS = {
  gmc: 'GMC registration',
  licence: 'Licence to practise',
  cct: 'CCT / specialist registration',
  dbs: 'DBS check',
  rightToWork: 'Right to work',
  indemnity: 'Indemnity cover',
  revalidation: 'GMC revalidation',
};

// Indemnity is the only credential whose lapse is unlawful to work through
// rather than merely non-compliant, so it is the only one that blocks.
const BLOCKING = new Set(['indemnity']);

export function credentialAlerts(credentials, { warnWithinDays = 30 } = {}) {
  return Object.entries(credentials)
    .map(([key, credential]) => {
      const { status, daysRemaining } = credential;
      const soon = typeof daysRemaining === 'number' && daysRemaining <= warnWithinDays;
      let tone = null;
      if (status === 'expired') tone = 'blocking';
      else if (status === 'expiring') tone = BLOCKING.has(key) ? 'blocking' : 'act';
      else if (status === 'pending') tone = 'watch';
      else if (soon) tone = 'watch';
      if (!tone) return null;
      return { key, label: LABELS[key] ?? key, status, daysRemaining, tone };
    })
    .filter(Boolean)
    .sort((a, b) => rank(b) - rank(a) || days(a) - days(b));
}

const RANK = { blocking: 3, act: 2, watch: 1 };
const rank = (alert) => RANK[alert.tone] ?? 0;
const days = (alert) => (typeof alert.daysRemaining === 'number' ? alert.daysRemaining : Infinity);

export function alertSentence(alert) {
  if (alert.status === 'expired') return `${alert.label} has expired.`;
  if (alert.status === 'pending') return `${alert.label} is still being verified.`;
  const d = alert.daysRemaining;
  return `${alert.label} expires in ${d} day${d === 1 ? '' : 's'}.`;
}
