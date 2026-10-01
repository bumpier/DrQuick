import { COMMISSION_TIERS, gpSharePercent } from '@/lib/finance/commission';
import { cn } from '@/lib/utils';

// What a GP keeps, drawn as the three steps it is: a lime block per tier, each
// taller than the last, on a forest ground. The figures and thresholds come
// from lib/finance/commission.ts, so the page can never disagree with the rule
// consultations are paid by. Made for the forest band (the GP pay tile and the
// sign-up pop-up): the captions are band-ink-2 and would not read on white.
//
// A list, not a chart: each step carries its own words, so it reads the same
// with the blocks switched off.
//
// `lg` is the pay tile on the page. `panel` is the pop-up's forest cell: short
// on a phone, where the form below it is the point, and tall from 900px, where
// the cell runs the height of the form beside it.
const SIZE = {
  lg: {
    list: 'gap-3',
    heights: ['h-24', 'h-34', 'h-44'],
    block: 'rounded-xl px-5 pb-4 max-phone:px-3 max-phone:pb-3',
    figure: 'text-[clamp(1.5rem,3.4vw,2.75rem)]',
    caption: 'mt-3 text-body',
  },
  panel: {
    list: 'gap-2',
    heights: ['h-11 md:h-24', 'h-15 md:h-35', 'h-19 md:h-46'],
    block: 'rounded-lg px-3 pb-2 md:rounded-xl md:px-4 md:pb-3.5',
    figure: 'text-2xl md:text-[1.875rem]',
    caption: 'mt-2 text-fine',
  },
} as const;

export function CommissionLadder({ size = 'lg', className }: { size?: keyof typeof SIZE; className?: string }) {
  const s = SIZE[size];
  return (
    <ol className={cn('commission-ladder flex items-end', s.list, className)}
      aria-label="Your share of each consultation">
      {COMMISSION_TIERS.map((tier, i) => (
        <li key={tier.from} className="min-w-0 flex-1" data-tier={tier.from}>
          <div className={cn('flex items-end bg-primary text-ink', s.block, s.heights[i])}>
            <span className={cn('font-display leading-none font-extrabold tracking-[-.035em] tabular-nums', s.figure)}>
              {gpSharePercent(tier)}%
            </span>
          </div>
          <p className={cn('text-band-ink-2', s.caption)}>
            {tier.from === 0 ? 'To start' : `After ${tier.from}`}
            <span className="sr-only">{tier.from === 0 ? ', from your first consultation' : ' completed consultations'}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
