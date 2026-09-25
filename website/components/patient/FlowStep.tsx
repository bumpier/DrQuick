'use client';

/* One booking screen. Every step and state renders through this, so the grid,
   the focus rule and the docked action are written once.

   Layouts:
   - split: the m.uber.com arrangement. From the md line a 30rem panel (the
     step) sits beside a canvas carrying the live status of this request: the
     request so far, the search, the matched GP, the call. Below it the canvas
     sits between the heading and the body, as Uber's map sits above its sheet.
     The canvas is last in the DOM and holds nothing focusable, so the visual
     reorder never changes the focus order.
   - column: a centred column, for the screens that end something.
   - band: the full-bleed dark fill, for the one hard stop (999).

   The action is docked, never a draggable sheet: someone unwell on a phone
   should never have to drag. It sticks to the bottom edge, the primary first,
   and lifts above the development jumper while that shows. */
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stepper, type Step } from '@/components/app/Stepper';
import { STEPPER_STEPS, type BookingStep } from '@/lib/booking-flow';
import { cn } from '@/lib/utils';
import { useBooking } from './BookingProvider';
import { UrgentLine } from './UrgentLine';

type Props = {
  screen: string;
  layout?: 'split' | 'column' | 'band';
  step?: BookingStep;                  // the five screens before commit carry the stepper
  back?: 'action' | string | null;     // 'action' steps back through the booking; a string is a link
  title: string;
  lead?: ReactNode;
  status?: ReactNode;                  // the canvas (split only)
  statusOnPhone?: boolean;
  urgent?: boolean;                    // the 999 line at the end of the body
  dock?: ReactNode;
  children?: ReactNode;
};

function stepsFor(step: BookingStep): Step[] {
  const at = STEPPER_STEPS.findIndex((s) => s.id === step);
  return STEPPER_STEPS.map((s, i) => ({ id: s.id, label: s.label, status: i < at ? 'done' : i === at ? 'current' : 'todo' }));
}

/* After a failed submit, the first field that needs fixing takes focus. A
   radio group is not focusable itself, so its first choice is. */
export function focusFirstInvalid() {
  const invalid = document.querySelector<HTMLElement>('[data-screen] [aria-invalid="true"]');
  if (!invalid) return;
  const target = invalid.getAttribute('role') === 'radiogroup'
    ? invalid.querySelector<HTMLElement>('[role="radio"]')
    : invalid;
  target?.focus();
}

export function ActionDock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="action-dock"
      className={cn(
        'sticky bottom-0 z-10 -mx-6 mt-auto grid gap-2 border-t border-rule bg-white px-6 pt-4 pb-6',
        'group-data-[jumper=true]/surface:bottom-(--jumper-h) max-phone:-mx-4 max-phone:px-4 max-phone:pb-4 md:-mx-10 md:px-10',
        className,
      )}
    >
      <noscript><p className="text-fine text-ink-2">Turn on JavaScript to continue.</p></noscript>
      {children}
    </div>
  );
}

export function FlowStep({
  screen, layout = 'split', step, back = null, title, lead, status, statusOnPhone = true, urgent = false, dock, children,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { state, act } = useBooking();

  // A screen the patient moved to by acting, or that the queue moved them to,
  // starts at the top with focus on its heading. Landing on a URL does not
  // move focus: the page is simply read from the top.
  const arrivedByAction = useRef(state.nav > 0);
  useEffect(() => {
    if (!arrivedByAction.current) return;
    window.scrollTo(0, 0);
    root.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, []);

  const band = layout === 'band';
  const backClass = band ? 'text-white hover:bg-white/10' : undefined;
  const head = (
    <div className="grid gap-5">
      {(back || step) && (
        <div className="flex min-h-10 items-center gap-3">
          {back === 'action' && (
            <Button type="button" variant="ghost" size="icon" aria-label="Back" className={backClass} onClick={() => act({ type: 'back' })}>
              <ArrowLeftIcon strokeWidth={2} />
            </Button>
          )}
          {typeof back === 'string' && back !== 'action' && (
            <Button asChild variant="ghost" size="icon" className={backClass}>
              <Link href={back} aria-label="Back to home"><ArrowLeftIcon strokeWidth={2} /></Link>
            </Button>
          )}
          {step && (
            <div className="min-w-0 flex-1">
              <Stepper label="Booking steps" labels="current" className="mb-0" steps={stepsFor(step)} />
            </div>
          )}
        </div>
      )}
      <div>
        <h1 data-reveal tabIndex={-1} className="text-headline max-phone:text-headline-sm">{title}</h1>
        {lead && <div className={cn('mt-2 max-w-[52ch] text-body', band ? 'text-band-muted' : 'text-ink-2')}>{lead}</div>}
      </div>
    </div>
  );

  const body = (
    <>
      <div className="grid gap-6 pb-8">
        {children}
        {urgent && <UrgentLine />}
      </div>
      {dock && <ActionDock>{dock}</ActionDock>}
    </>
  );

  if (layout === 'band') {
    return (
      <div ref={root} data-screen={screen} data-layout="band" className="band-grid flex flex-1 flex-col bg-band text-white">
        <div className="mx-auto w-full max-w-[32rem] px-6 py-10 max-phone:px-4 max-phone:py-8">
          {head}
          <div className="mt-8 grid gap-6">{children}</div>
        </div>
      </div>
    );
  }

  if (layout === 'column') {
    return (
      <div ref={root} data-screen={screen} data-layout="column" className="flex flex-1 flex-col bg-white">
        <div className="mx-auto flex w-full max-w-[32rem] flex-1 flex-col px-6 pt-8 max-phone:px-4 max-phone:pt-6 md:px-10 md:pt-14">
          {head}
          <div className="mt-8 flex flex-1 flex-col">{body}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={root}
      data-screen={screen}
      data-layout="split"
      className={cn(
        "grid flex-1 grid-rows-[auto_auto_1fr] bg-white [grid-template-areas:'head'_'canvas'_'body']",
        "md:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:bg-lime-wash md:[grid-template-areas:'head_canvas'_'body_canvas']",
      )}
    >
      <div className="px-6 pt-6 pb-2 [grid-area:head] max-phone:px-4 md:border-r md:border-rule md:bg-white md:px-10 md:pt-10">
        {head}
      </div>
      {status && (
        <div
          data-slot="flow-canvas"
          className={cn(
            'flex items-center justify-center px-6 py-4 [grid-area:canvas] max-phone:px-4',
            'md:sticky md:top-(--header-h) md:h-[calc(100svh-var(--header-h))] md:self-start md:p-10',
            !statusOnPhone && 'max-md:hidden',
          )}
        >
          {status}
        </div>
      )}
      <div className="flex flex-col px-6 pt-6 [grid-area:body] max-phone:px-4 md:border-r md:border-rule md:bg-white md:px-10">
        {body}
      </div>
    </div>
  );
}
