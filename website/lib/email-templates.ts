// The emails the site sends, as plain functions of their data. Inline styles
// only (mail clients ignore stylesheets), Lime & Forest colours, and a text
// part for every HTML part. The public-facing ones must pass checkCopy()
// (tests/email.test.ts), the same rules the site's copy lives under.
import type { Signup } from '@/lib/waitlist';

export type Email = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(heading: string, paragraphs: string[], footer: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#163300">${p}</p>`).join('');
  return `<!doctype html><html lang="en-GB"><body style="margin:0;background:#F5F7F2;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7F2;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#163300;padding:20px 28px;font-size:20px;font-weight:800;color:#9FE870">Dr Quick</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#163300">${heading}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:13px;line-height:1.5;color:#4D5B45;border-top:1px solid #DCE4D4">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function patientWelcome(unsubscribeUrl: string): Email {
  const paras = [
    'Thanks for joining the Dr Quick waitlist.',
    'We are building a way to see a UK-registered GP by video, paying per consultation with no membership. We will email you once when we open in your area, and not before.',
    'Nothing else to do for now.',
  ];
  const footer = `You are getting this because this address joined the waitlist at drquick.co.uk. <a href="${esc(unsubscribeUrl)}" style="color:#2F6B0F">Unsubscribe</a> and we will delete it.`;
  return {
    subject: "You're on the Dr Quick waitlist",
    html: layout("You're on the list", paras, footer),
    text: `${paras.join('\n\n')}\n\nUnsubscribe: ${unsubscribeUrl}\n`,
  };
}

export function gpApplicationReceived(name: string, unsubscribeUrl: string): Email {
  const paras = [
    `Hello ${esc(name)},`,
    'Thanks for your interest in consulting with Dr Quick. We have your details.',
    'What happens next: we check your GMC registration, then a member of the team will contact you by email or phone to talk through how sessions, indemnity and pay work. There is no commitment until you have seen the contractor terms.',
  ];
  const footer = `You applied at drquick.co.uk. <a href="${esc(unsubscribeUrl)}" style="color:#2F6B0F">Withdraw and delete my details</a>.`;
  return {
    subject: 'Your Dr Quick GP application',
    html: layout('Application received', paras, footer),
    text: `${strip(paras.join('\n\n'))}\n\nWithdraw and delete my details: ${unsubscribeUrl}\n`,
  };
}

// Internal only: never shown to the public, so not held to checkCopy().
export function adminNewGp(signup: Pick<Signup, 'name' | 'email' | 'mobile' | 'gmc' | 'source'>, adminUrl: string): Email {
  const rows: [string, string][] = [
    ['Name', signup.name ?? ''], ['Email', signup.email], ['Mobile', signup.mobile ?? ''],
    ['GMC', signup.gmc ?? ''], ['Form', signup.source],
  ];
  const paras = [
    rows.map(([k, v]) => `<strong>${k}:</strong> ${esc(v)}`).join('<br>'),
    `<a href="${esc(adminUrl)}" style="color:#2F6B0F;font-weight:700">Open in the admin</a>`,
  ];
  return {
    subject: `New GP application: ${signup.name ?? signup.email}`,
    html: layout('New GP application', paras, 'Sent to the addresses in ADMIN_ALERT_EMAILS.'),
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${adminUrl}\n`,
  };
}
