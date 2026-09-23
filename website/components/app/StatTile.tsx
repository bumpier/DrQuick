import { cn } from '@/lib/utils';

// A figure and what it is. The value arrives already formatted — through
// shown() or live() — so a blank-mode tile carries the em dash in the same face
// and size as the number it stands in for, and nothing shifts when data lands.
// Both sizes are Geist, tabular, tracked no tighter than -.03em (DESIGN.md
// numerals). The tile is not a card: several sit inside one.
const VALUE = {
  lg: 'font-display text-4xl font-bold tracking-[-.03em] leading-none tabular-nums',
  sm: 'font-display text-2xl font-semibold tracking-[-.02em] leading-none tabular-nums',
} as const;

// ink-2 on white; band-ink-2 inside a band Card.
const MUTED = 'text-fine text-ink-2 group-data-[variant=band]/card:text-band-ink-2';

type Props = {
  label: string;
  value: string;
  note?: string;
  size?: 'lg' | 'sm';
  against?: string;
  className?: string;
};

export function StatTile({ label, value, note, size = 'lg', against, className }: Props) {
  return (
    <div data-slot="stat-tile" data-size={size} className={cn('grid min-w-0 content-start gap-1', className)}>
      <span data-slot="stat-value" className={VALUE[size]}>{value}</span>
      <span className={MUTED}>{label}</span>
      {note && <span className={MUTED}>{note}</span>}
      {against && <span data-slot="stat-against" className={MUTED}>{against}</span>}
    </div>
  );
}
