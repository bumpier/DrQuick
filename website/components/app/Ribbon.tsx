import { cn } from '@/lib/utils';

// Prototype chrome, deliberately not the product: the sentence that has to be on
// every dashboard screen and cannot be dismissed. A note rather than a live
// region — it never changes, so it has nothing to announce — and the product's
// label-caps face rather than a third typeface: only the state jumper is
// monospace. Sticky at z-20 it sits above the rail (z-10); AppShell fixes its
// height to --ribbon-h and offsets the rail by the same amount.
export function Ribbon({ className }: { className?: string }) {
  return (
    <p
      role="note"
      data-slot="ribbon"
      className={cn(
        'sticky top-0 z-20 flex items-center bg-band px-4 py-2 font-display text-[11px] font-semibold uppercase leading-[1.2] tracking-[.05em] text-white',
        className,
      )}
    >
      Prototype. Not a live service — no real patients, GPs, or data.
    </p>
  );
}
