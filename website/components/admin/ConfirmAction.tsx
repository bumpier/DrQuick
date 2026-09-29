'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

type Result = { ok: true; message?: string } | { ok: false; error: string } | void;

// A button that asks before it acts. The dialog names what will happen in
// plain words; the action runs on confirm and its outcome is a toast. An
// action that redirects (erase) never resolves here, which is fine.
export function ConfirmAction({ trigger, title, description, confirmLabel, run, destructive = false, disabled = false, onDone }: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  run: () => Promise<Result>;
  destructive?: boolean;
  disabled?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const confirm = () => start(async () => {
    const result = await run();
    setOpen(false);
    if (!result) return;
    if (result.ok) { if (result.message) toast.success(result.message); onDone?.(); }
    else toast.error(result.error);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild disabled={disabled}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild><div>{description}</div></DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary" disabled={pending}>Cancel</Button></DialogClose>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={confirm} aria-busy={pending || undefined} disabled={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
