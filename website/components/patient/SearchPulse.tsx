import { cn } from '@/lib/utils';

// What stands in for Uber's map while a GP is found: the request at the
// centre and a slow ring going out from it. Functional motion (it says the
// search is still running), drawn in authored SVG on the primary at low
// weight, animated only under prefers-reduced-motion: no-preference (see
// .pulse-ring in app/globals.css); reduced, the rings sit still and the
// ticking numbers beside it carry the news. It never counts anything: no GPs,
// no patients.
export function SearchPulse({ className }: { className?: string }) {
  return (
    <div
      data-slot="search-pulse"
      aria-hidden="true"
      className={cn('grid aspect-square w-full max-w-[20rem] place-items-center max-md:max-w-[11rem]', className)}
    >
      <svg viewBox="0 0 320 320" className="size-full overflow-visible">
        <circle cx="160" cy="160" r="152" className="fill-none stroke-ink/10" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="160" cy="160" r="104" className="fill-none stroke-ink/10" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="160" cy="160" r="56" className="fill-white stroke-ink/10" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="160" cy="160" r="18" className="pulse-ring fill-none stroke-primary-ink" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx="160" cy="160" r="18" className="pulse-ring pulse-ring-late fill-none stroke-primary-ink" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx="160" cy="160" r="12" className="fill-primary-ink stroke-white" strokeWidth="3" />
      </svg>
    </div>
  );
}
