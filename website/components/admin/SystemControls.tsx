'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SendIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { eraseByEmailAction, resendEmailAction } from '@/app/admin/(panel)/system/actions';
import { ConfirmAction } from './ConfirmAction';

// "Resend" on one failed or skipped row of the email log.
export function ResendEmailButton({ logId }: { logId: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => start(async () => {
        const result = await resendEmailAction(logId);
        if (result.ok) toast.success(result.message ?? 'Sent.');
        else toast.error(result.error);
        router.refresh();
      })}
    >
      <SendIcon strokeWidth={2} className="size-4" aria-hidden="true" />
      Resend
    </Button>
  );
}

// Erase a person by email address, asked for in a dialog first.
export function EraseByEmail() {
  const [email, setEmail] = useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 flex-1 basis-72 gap-1 text-fine font-semibold text-ink-2">
        Email address
        <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </label>
      <ConfirmAction
        disabled={!valid}
        destructive
        trigger={
          <Button variant="destructive" disabled={!valid}>
            <Trash2Icon strokeWidth={2} className="size-4" aria-hidden="true" />
            Erase this person
          </Button>
        }
        title="Erase everything for this address?"
        description={<>
          <p>Every sign-up for <strong className="break-all text-ink">{email.trim()}</strong> (as a patient and as a GP), the visit history linked to them and every email sent to them will be deleted.</p>
          <p className="mt-2">This cannot be undone. The audit log records that an erasure happened, never the address.</p>
        </>}
        confirmLabel="Erase"
        run={() => eraseByEmailAction(email)}
        onDone={() => setEmail('')}
      />
    </div>
  );
}
