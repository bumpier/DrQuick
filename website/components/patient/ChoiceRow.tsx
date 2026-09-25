import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// A whole row is the target, not the 20px control inside it: the label wraps
// the radio or checkbox, so a tap anywhere on it chooses. Chosen is told by
// fill and a primary ring, and by the control itself, never by hue alone. The
// tile layout stacks the control over a short label, for a row of three.
export function ChoiceRow({ control, children, hint, layout = 'row', className }: {
  control: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  layout?: 'row' | 'tile';
  className?: string;
}) {
  return (
    <label
      data-slot="choice-row"
      className={cn(
        'flex cursor-pointer gap-3 rounded-lg bg-surface-mid px-4 py-3 text-body font-semibold text-ink',
        'transition-[background-color,box-shadow] duration-160 ease-(--ease) hover:bg-fill',
        'has-[[data-state=checked]]:bg-white has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary-ink has-[[data-state=checked]]:ring-inset',
        layout === 'row' ? 'min-h-14 items-center' : 'min-h-18 flex-col items-center justify-center gap-2 px-2 text-center',
        className,
      )}
    >
      {control}
      <span className="min-w-0">
        {children}
        {hint && <span className="mt-0.5 block text-fine font-normal text-ink-2">{hint}</span>}
      </span>
    </label>
  );
}
