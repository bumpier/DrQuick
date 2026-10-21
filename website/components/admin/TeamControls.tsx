'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CopyIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  addMemberAction, changeRoleAction, removeMemberAction, sendLinkAction, type TeamResult,
} from '@/app/admin/(panel)/system/team/actions';
import { ROLES, ROLE_LABELS, ROLE_SUMMARIES, type Role } from '@/lib/admin/roles';
import { ConfirmAction } from './ConfirmAction';

function report(result: TeamResult) {
  if (result.ok) toast.success(result.message);
  else toast.error(result.error);
}

function RoleItems() {
  return ROLES.map((r) => (
    <SelectItem key={r} value={r}>
      <span className="grid text-left">
        <span className="font-semibold">{ROLE_LABELS[r]}</span>
        <span className="text-fine text-ink-2">{ROLE_SUMMARIES[r]}</span>
      </span>
    </SelectItem>
  ));
}

async function copy(link: string) {
  try {
    await navigator.clipboard.writeText(link);
    toast.success('Link copied.');
  } catch {
    toast.error('Could not copy. Select the link and copy it yourself.');
  }
}

export function AddMemberCard() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [shown, setShown] = useState<{ message: string; link: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    const result = await addMemberAction({ name, email, role });
    if (!result.ok) { toast.error(result.error); return; }
    setName(''); setEmail(''); setRole('');
    if (result.link) setShown({ message: result.message, link: result.link });
    else { setShown(null); toast.success(result.message); }
  });

  return (
    <Card size="sm" className="mb-4 min-w-0">
      <CardHeader><CardTitle>Add a person</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="grid w-full max-w-none grid-cols-[1fr_1fr_minmax(0,16rem)_auto] items-end gap-4 max-cols:grid-cols-1"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="team-name">Name</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={100} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="team-email">Email</Label>
            <Input id="team-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="team-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={pending}>
              <SelectTrigger id="team-role" className="w-full" aria-label="Role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent><RoleItems /></SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            <SendIcon strokeWidth={2} />Send invite
          </Button>
        </form>
        {shown && (
          <div role="status" className="grid gap-2 rounded-lg bg-surface-mid p-4">
            <p>{shown.message}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Input readOnly value={shown.link} aria-label="Set-password link" className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="secondary" size="sm" onClick={() => copy(shown.link)}><CopyIcon strokeWidth={2} />Copy link</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RoleControl({ id, role }: { id: string; role: Role }) {
  const [value, setValue] = useState<Role>(role);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={value} onValueChange={(v) => setValue(v as Role)} disabled={pending}>
        <SelectTrigger className="min-w-40" aria-label="Role"><SelectValue /></SelectTrigger>
        <SelectContent><RoleItems /></SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={pending || value === role}
        aria-busy={pending || undefined}
        onClick={() => start(async () => report(await changeRoleAction(id, value)))}
      >
        Save role
      </Button>
    </div>
  );
}

export function SendLinkButton({ id }: { id: string }) {
  const [shown, setShown] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() => start(async () => {
          const result = await sendLinkAction(id);
          report(result);
          setShown(result.ok && result.link ? result.link : null);
        })}
      >
        <SendIcon strokeWidth={2} />Send new link
      </Button>
      {shown && (
        <div className="flex flex-wrap items-center gap-2">
          <Input readOnly value={shown} aria-label="Set-password link" className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="secondary" size="sm" onClick={() => copy(shown)}><CopyIcon strokeWidth={2} />Copy link</Button>
        </div>
      )}
    </div>
  );
}

export function RemoveButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      destructive
      trigger={<Button variant="destructive" size="sm"><Trash2Icon strokeWidth={2} />Remove</Button>}
      title={`Remove ${name}?`}
      description="They lose access on their next click. You can add them again later."
      confirmLabel="Remove"
      run={() => removeMemberAction(id)}
    />
  );
}
