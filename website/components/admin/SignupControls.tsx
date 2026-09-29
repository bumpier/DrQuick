'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SendIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  erasePersonAction, resendConfirmationAction, saveNotesAction, setStatusAction, type ActionResult,
} from '@/app/admin/(panel)/waitlist/actions';
import { NOTES_MAX } from '@/lib/admin/format';
import { ConfirmAction } from './ConfirmAction';

function report(result: ActionResult) {
  if (result.ok) toast.success(result.message ?? 'Saved.');
  else toast.error(result.error);
}

export function StatusControl({ id, status, options }: {
  id: string;
  status: string;
  options: Array<{ value: string; label: string }>;
}) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={value} onValueChange={setValue} disabled={pending}>
        <SelectTrigger className="min-w-48" aria-label="Status"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={pending || value === status}
        aria-busy={pending || undefined}
        onClick={() => start(async () => report(await setStatusAction(id, value)))}
      >
        Save status
      </Button>
    </div>
  );
}

export function NotesControl({ id, notes }: { id: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const [saved, setSaved] = useState(notes);
  const [pending, start] = useTransition();
  const dirty = value !== saved;
  return (
    <div className="grid gap-3">
      <label className="sr-only" htmlFor={`notes-${id}`}>Notes</label>
      <Textarea
        id={`notes-${id}`}
        value={value}
        maxLength={NOTES_MAX}
        rows={5}
        placeholder="Anything the team should know. Only admins see this."
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={pending || !dirty}
          aria-busy={pending || undefined}
          onClick={() => start(async () => {
            const result = await saveNotesAction(id, value);
            report(result);
            if (result.ok) setSaved(value);
          })}
        >
          Save notes
        </Button>
        <span className="text-fine text-ink-2">{dirty ? 'Unsaved changes' : 'Saved'}</span>
      </div>
    </div>
  );
}

export function ResendButton({ id, role }: { id: string; role: 'patient' | 'gp' }) {
  return (
    <ConfirmAction
      trigger={<Button variant="secondary" size="sm"><SendIcon strokeWidth={2} />Resend confirmation</Button>}
      title="Resend the confirmation email?"
      description={role === 'gp'
        ? 'They will get the “Application received” email again, with the link to withdraw.'
        : 'They will get the “You’re on the list” email again, with the link to unsubscribe.'}
      confirmLabel="Send it"
      run={() => resendConfirmationAction(id)}
    />
  );
}

export function EraseButton({ id, email }: { id: string; email: string }) {
  return (
    <ConfirmAction
      destructive
      trigger={<Button variant="destructive" size="sm"><Trash2Icon strokeWidth={2} />Erase this person</Button>}
      title="Erase this person?"
      description={(
        <>
          <p>This permanently deletes <strong className="break-all text-ink">{email}</strong> from both waitlists, their email history and any visit history linked to them.</p>
          <p className="mt-2">Use it for a right-to-erasure request. It cannot be undone.</p>
        </>
      )}
      confirmLabel="Erase permanently"
      run={() => erasePersonAction(id)}
    />
  );
}
