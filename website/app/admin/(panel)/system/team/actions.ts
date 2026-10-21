'use server';
// The Team page's server actions. Each is an untrusted POST: it starts with
// actionAdmin('team'), lets lib/admin/team.ts validate every argument, and
// writes one audit row naming the member by id, never by address.
import { revalidatePath } from 'next/cache';
import { NOT_YOUR_ROLE, actionAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/admin/audit';
import { ROLE_LABELS } from '@/lib/admin/roles';
import { addMember, changeRole, removeMember, sendLink, type LinkOutcome, type TeamError } from '@/lib/admin/team';
import { getDb } from '@/lib/db';

export type TeamResult = { ok: true; message: string; link?: string } | { ok: false; error: string };

const NO_DB: TeamResult = { ok: false, error: 'The database is not configured on this server (set DATABASE_URL).' };

const ERRORS: Record<TeamError, string> = {
  invalid_name: 'Enter their name.',
  invalid_email: 'Enter a full email address.',
  invalid_role: 'Choose a role.',
  on_backstop: 'This address is already a backstop Admin in the server settings.',
  already_member: 'This person is already on the team.',
  not_found: 'This person is no longer on the team.',
  self: 'You cannot change your own role or remove yourself.',
  last_admin: 'The team needs at least one Admin who can sign in.',
  not_sent: 'The email could not be sent, so no new link was made. Their earlier link, if they have one, still works.',
};

const SHOWN = 'The email could not be sent. Copy this link and pass it on yourself. It works once, for 24 hours, and will not be shown again.';

const refuse = (error: TeamError): TeamResult => ({ ok: false, error: ERRORS[error] });
const refresh = () => revalidatePath('/admin/system/team');

function delivered(outcome: Extract<LinkOutcome, { ok: true }>, sentMessage: string): TeamResult {
  return outcome.delivery === 'shown'
    ? { ok: true, message: SHOWN, link: outcome.url }
    : { ok: true, message: sentMessage };
}

export async function addMemberAction(input: { name: string; email: string; role: string }): Promise<TeamResult> {
  const admin = await actionAdmin('team');
  if (!admin) return NOT_YOUR_ROLE;
  const db = await getDb();
  if (!db) return NO_DB;
  const r = await addMember(db, admin, { name: input?.name, email: input?.email, role: input?.role });
  if (!r.ok) return refuse(r.error);
  await audit(db, admin, 'team_add', r.id, { role: input.role, linkShown: r.delivery === 'shown' });
  refresh();
  return delivered(r, `Invite sent to ${String(input.email).trim().toLowerCase()}.`);
}

export async function sendLinkAction(id: string): Promise<TeamResult> {
  const admin = await actionAdmin('team');
  if (!admin) return NOT_YOUR_ROLE;
  const db = await getDb();
  if (!db) return NO_DB;
  const r = await sendLink(db, admin, id);
  if (!r.ok) return refuse(r.error);
  await audit(db, admin, 'team_link', r.id, { linkShown: r.delivery === 'shown' });
  refresh();
  return delivered(r, 'New link sent.');
}

export async function changeRoleAction(id: string, role: string): Promise<TeamResult> {
  const admin = await actionAdmin('team');
  if (!admin) return NOT_YOUR_ROLE;
  const db = await getDb();
  if (!db) return NO_DB;
  const r = await changeRole(db, admin, id, role);
  if (!r.ok) return refuse(r.error);
  if (r.from === r.to) return { ok: true, message: 'No change.' };
  await audit(db, admin, 'team_role', r.id, { from: r.from, to: r.to });
  refresh();
  return { ok: true, message: `Role changed to ${ROLE_LABELS[r.to]}.` };
}

export async function removeMemberAction(id: string): Promise<TeamResult> {
  const admin = await actionAdmin('team');
  if (!admin) return NOT_YOUR_ROLE;
  const db = await getDb();
  if (!db) return NO_DB;
  const r = await removeMember(db, admin, id);
  if (!r.ok) return refuse(r.error);
  await audit(db, admin, 'team_remove', r.id, { role: r.role });
  refresh();
  return { ok: true, message: `${r.name} no longer has access.` };
}
