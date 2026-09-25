import { cn } from '@/lib/utils';

// The wordmark, defined once (DESIGN.md, Lime & Forest): "Dr" in the surface's
// text colour, "Quick" set on a lime pill in forest. The pill reads the same on
// the ground, on white and on the forest band, so there is no band variant. It
// is inline text, never an image, so the accessible name stays "DrQuick" and a
// wrapping link can override it with aria-label.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-extrabold tracking-[-.04em] whitespace-nowrap', className)}>
      Dr<span className="ml-[.12em] inline-block rounded-pill bg-primary px-[.32em] pb-[.06em] text-ink">Quick</span>
    </span>
  );
}
