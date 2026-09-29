// What an email_log error means, in words an admin can act on. Pure. The raw
// text (lib/email.ts writes it) stays in the database; this is only its face.

export const TEMPLATE_LABELS: Record<string, string> = {
  patient_welcome: 'Patient welcome',
  gp_received: 'GP application received',
  admin_new_gp: 'New GP alert (team)',
};
export const templateLabel = (t: string) => TEMPLATE_LABELS[t] ?? t;

export const EMAIL_STATUS_LABELS: Record<string, string> = { sent: 'Sent', failed: 'Failed', skipped: 'Not sent' };

export function humanEmailError(error: string | null | undefined): string | null {
  if (!error) return null;
  if (/RESEND_API_KEY|EMAIL_FROM/.test(error) && /not set/i.test(error)) {
    return 'Email isn’t set up yet (RESEND_API_KEY and EMAIL_FROM), so nothing was sent.';
  }
  const http = /^(\d{3}):\s*(.*)$/s.exec(error);
  if (http) {
    const code = Number(http[1]);
    const detail = http[2] && http[2] !== 'unknown error' ? `: ${http[2]}` : '';
    if (code === 401 || code === 403) return `Resend refused the API key (${code})${detail}. Check RESEND_API_KEY.`;
    if (code === 422 || code === 400) return `Resend rejected the message (${code})${detail}. Often EMAIL_FROM is not on a verified domain.`;
    if (code === 429) return 'Resend’s rate limit was hit (429). Try again in a minute.';
    if (code >= 500) return `Resend had a problem of its own (${code})${detail}. Try again later.`;
    return `Resend answered ${code}${detail}.`;
  }
  if (/timeout|aborted/i.test(error)) return 'Resend didn’t answer within 5 seconds.';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|network/i.test(error)) return 'Couldn’t reach Resend (a network error).';
  return error;
}
