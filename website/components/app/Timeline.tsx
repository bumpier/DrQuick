import { cn } from '@/lib/utils';

export type TimelineStep = { label: string; when?: string | null; done: boolean; now?: boolean };

// A journey as the steps it is actually on, not a single status word: a
// prescription is written, sent, ready to collect, collected. Done steps are
// ink, the current step is the primary mark and carries aria-current, and the
// steps still to come are muted by weight as well as colour, so the state
// never rests on a hue alone. Screen readers get the state as words.
export function Timeline({ steps, label = 'Progress' }: { steps: readonly TimelineStep[]; label?: string }) {
  return (
    <ol aria-label={label} data-slot="timeline" className="grid">
      {steps.map((step, i) => {
        const state = step.done ? 'done' : step.now ? 'now' : 'todo';
        return (
          <li
            key={step.label}
            data-step={state}
            aria-current={step.now ? 'step' : undefined}
            className="relative grid grid-cols-[12px_1fr] gap-3 pb-4 last:pb-0"
          >
            {i < steps.length - 1 && <span aria-hidden="true" className="absolute top-5 bottom-1 left-[5.5px] w-px bg-rule" />}
            <span
              aria-hidden="true"
              className={cn(
                'mt-1.5 size-3 rounded-sm border',
                state === 'done' && 'border-ink bg-ink',
                state === 'now' && 'border-primary bg-primary',
                state === 'todo' && 'border-outline bg-white',
              )}
            />
            <span className="min-w-0">
              <span className={cn('block text-body', state === 'todo' ? 'text-ink-2' : 'font-semibold text-ink')}>
                {step.label}
                <span className="sr-only">{state === 'done' ? ', done' : state === 'now' ? ', current step' : ', not yet'}</span>
              </span>
              {step.when && <span className="block text-fine text-ink-2">{step.when}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
