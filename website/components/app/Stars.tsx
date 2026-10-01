import { StarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Five stars filled in proportion to the value, so 4.55 is four and a bit over
// half, never five: a row of full stars is a score the GP may not have.
// Decoration beside the figure, never instead of it: the number and the count
// are always written out, so this is hidden from assistive technology. On a
// light surface the fill is primary-ink, never lime (DESIGN.md: lime is a fill
// for controls, not a mark).
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span data-slot="stars" aria-hidden="true" className={cn('inline-flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block size-5">
            <StarIcon strokeWidth={2} className="size-5 text-rule" />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <StarIcon strokeWidth={2} className="size-5 fill-current text-primary-ink" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
