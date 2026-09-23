import { cn } from '@/lib/utils';

export type StepStatus = 'done' | 'current' | 'todo';
export type Step = { id: string; label: string; status: StepStatus };

// The preview's stepper was six bars and nothing else. A bar's fill is colour
// and weight alone, so each step also carries its label and, for a screen
// reader, whether it is done; the current step is the one with aria-current.
// Below the phone line only the current label is visible — six labels do not
// fit in 358px — the rest stay in the accessible name.
// `label` names the list for a screen reader (the doctor's onboarding and the
// patient's booking share the component); `className` lets a caller that
// sets its own spacing drop the default margin; `labels="current"` shows only
// the current step's word at every width, for a rail too narrow to carry all
// of them (the rest stay in the accessible name).
export function Stepper({ steps, label = 'Onboarding steps', className, labels = 'all' }: {
  steps: readonly Step[];
  label?: string;
  className?: string;
  labels?: 'all' | 'current';
}) {
  return (
    <ol aria-label={label} data-slot="stepper" className={cn('mb-6 flex gap-1', className)}>
      {steps.map((step) => (
        <li
          key={step.id}
          data-step={step.status}
          aria-current={step.status === 'current' ? 'step' : undefined}
          className="min-w-0 flex-1"
        >
          <div data-slot="step-bar" className={cn('h-0.75 rounded-pill', step.status === 'todo' ? 'bg-fill' : 'bg-ink')} />
          <span
            className={cn(
              // Truncation is a desk concern: above the phone line six labels
              // share the rail and a long one must clip. Below it only the
              // current label renders, and its own sixth of 358px would clip it
              // to "Regi…" — so there it overflows its cell, which is empty.
              'mt-2 block whitespace-nowrap text-fine sm:truncate',
              step.status === 'current' ? 'font-semibold text-ink' : cn('text-ink-2 max-phone:sr-only', labels === 'current' && 'sr-only'),
            )}
          >
            {step.label}
            {step.status === 'done' && <span className="sr-only"> completed</span>}
            {step.status === 'todo' && <span className="sr-only"> not started</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
