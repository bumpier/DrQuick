// The bento. Tiles must vary in span, fill and layout; three identical cards
// is a failure (CLAUDE.md). Step one is the wide lime-wash tile with its
// numeral set large, step two the narrow white tile with a stone numeral disc,
// and step three, the payoff, the full-width forest band — it stays third in
// the sequence and is the Card's band variant.
import type { Tile } from '@/app/landing-content';
import { Card } from '@/components/ui/card';

export function Steps({ headingId, section, title, tiles }: {
  headingId: string; section?: string; title: string; tiles: [Tile, Tile, Tile];
}) {
  const [a, b, c] = tiles;
  return (
    <section className="steps pt-section" aria-labelledby={headingId} data-section={section}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading max-w-[18ch]">{title}</h2>
        <div className="bento grid grid-cols-6 gap-4 max-cols:grid-cols-2" data-stagger>
          <Card variant="wash" data-reveal
            className="tile col-span-4 max-cols:col-span-1 max-phone:col-span-2 min-h-[280px] max-cols:min-h-0 justify-between gap-10 p-tile-lead-pad">
            <span aria-hidden="true" className="font-display text-[5rem] leading-[.8] font-extrabold tracking-[-.05em] text-primary-ink">1</span>
            <div>
              <h3 className="text-title-lead font-extrabold leading-[1.15] tracking-[-.03em]">{a.title}</h3>
              <p className="text-body text-ink-2 mt-2.5 max-w-[44ch]">{a.body}</p>
            </div>
          </Card>
          <Card data-reveal
            className="tile col-span-2 max-cols:col-span-1 max-phone:col-span-2 justify-between gap-10 p-8">
            <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-stone font-display text-2xl font-extrabold text-ink">2</span>
            <div>
              <h3>{b.title}</h3>
              <p className="text-body text-ink-2 mt-2.5">{b.body}</p>
            </div>
          </Card>
          <Card variant="band" data-reveal
            className="tile band-grid col-span-6 max-cols:col-span-2 p-tile-lead-pad grid grid-cols-[auto_1fr_1.35fr] gap-x-12 gap-y-3 max-cols:grid-cols-1 max-cols:gap-4 items-center">
            <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-primary font-display text-3xl font-extrabold text-ink">3</span>
            <h3 className="text-title-lead font-extrabold leading-[1.15] tracking-[-.03em]">{c.title}</h3>
            <p className="text-[1.0625rem] text-band-muted mt-0">{c.body}</p>
          </Card>
        </div>
      </div>
    </section>
  );
}
