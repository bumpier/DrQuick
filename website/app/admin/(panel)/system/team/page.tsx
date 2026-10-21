import type { Metadata } from 'next';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { AddMemberCard, RemoveButton, RoleControl, SendLinkButton } from '@/components/admin/TeamControls';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminAccounts, requireAdmin } from '@/lib/admin-auth';
import { ago, fmtDateTime } from '@/lib/admin/format';
import { ROLE_LABELS, type Role } from '@/lib/admin/roles';
import { listTeam } from '@/lib/admin/team';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Team' };

export default async function TeamPage() {
  const me = await requireAdmin('team');
  const db = await getDb();

  const header = <AdminPageHeader title="Team" description="Who can sign in to the admin, and what each person can do." />;
  if (!db) return <>{header}<NoDatabase /></>;

  const members = await listTeam(db);
  const backstop = [...adminAccounts().values()];
  const you = (m: { id: string }) => me.id !== null && m.id === me.id;

  return (
    <>
      {header}
      <AddMemberCard />
      <Card className="block px-4 py-3 max-phone:px-2">
        {members.length === 0 && backstop.length === 0 ? (
          <EmptyState className="my-2">No one has access yet.</EmptyState>
        ) : (
          <Table stack="cols">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const mine = you(m);
                const status = m.status === 'invited'
                  ? (m.linkExpiresAt ? `Invite sent, expires ${fmtDateTime(m.linkExpiresAt)}` : 'Invite expired')
                  : (m.lastSignInAt ? `Active, last signed in ${ago(m.lastSignInAt)}` : 'Active, never signed in');
                return (
                  <TableRow key={m.id}>
                    <TableCell data-label="Name" className="whitespace-normal font-semibold">
                      {m.name}{mine && <span className="font-normal text-ink-2"> (you)</span>}
                    </TableCell>
                    <TableCell data-label="Email" className="whitespace-normal break-all text-ink-2">{m.email}</TableCell>
                    <TableCell data-label="Role" className="whitespace-normal">
                      {mine ? ROLE_LABELS[m.role as Role] : <RoleControl key={`${m.id}:${m.role}`} id={m.id} role={m.role as Role} />}
                    </TableCell>
                    <TableCell data-label="Status" className="whitespace-normal text-ink-2">{status}</TableCell>
                    <TableCell data-label="Actions" className="whitespace-normal">
                      <div className="flex flex-wrap items-start gap-2">
                        <SendLinkButton id={m.id} />
                        {!mine && <RemoveButton id={m.id} name={m.name} />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {backstop.map((b) => (
                <TableRow key={b.email}>
                  <TableCell data-label="Name" className="whitespace-normal font-semibold">
                    {b.name}{me.id === null && b.email === me.email && <span className="font-normal text-ink-2"> (you)</span>}
                  </TableCell>
                  <TableCell data-label="Email" className="whitespace-normal break-all text-ink-2">{b.email}</TableCell>
                  <TableCell data-label="Role">{ROLE_LABELS.admin}</TableCell>
                  <TableCell data-label="Status" className="whitespace-normal text-ink-2">From server settings</TableCell>
                  <TableCell data-label="Actions" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
