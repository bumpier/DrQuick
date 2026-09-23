import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// A list with nothing in it says so in a sentence — "No consultations yet." —
// never an illustration and never a skeleton: nothing is loading, nothing has
// happened. Every list on the dashboards renders this until the platform has
// produced something, in both data modes.
export function EmptyState({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty"
      className={cn('rounded-xl border border-dashed border-rule py-8 text-center text-body text-ink-2', className)}
      {...props}
    />
  );
}
