'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// The two exits that cannot be taken back, cancelling a request and ending a
// call, are confirmed in a dialog rather than a two-step button a shaking
// hand can double-tap. Focus opens on the safe choice, which is listed first.
export function ConfirmDialog({ trigger, title, description, cancelLabel, confirmLabel, onConfirm }: {
  trigger: ReactNode;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="lg">{cancelLabel}</Button>
          </DialogClose>
          <Button size="lg" onClick={() => { setOpen(false); onConfirm(); }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
