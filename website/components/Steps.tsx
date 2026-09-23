// The bento. Tiles must vary in span, fill and layout; three identical cards
// is a failure (CLAUDE.md). Tiles are the shared Card — borderless, a white
// surface lifted off the ground by the tier-2 shadow. The dark fill belongs to
// step three, the payoff, which stays third in the sequence and is the Card's
// band variant.
import type { Tile } from '@/app/landing-content';
import { Card } from '@/components/ui/card';

export function Steps({ headingId, title, tiles }: {
  headingId: string; title: string; tiles: [Tile, Tile, Tile];
}) {
  const [a, b, c] = tiles;
  return (
    <section className="steps py-section" aria-labelledby={headingId}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading max-w-[18ch]">{title}</h2>
        <div className="bento grid grid-cols-6 gap-4 max-cols:grid-cols-2" data-stagger>
          {[a, b].map((tile) => (
            <Card key={tile.title} data-reveal
              className="tile block p-7 col-span-3 max-cols:col-span-1 max-phone:col-span-2">
              <h3>{tile.title}</h3>
              <p className="text-body text-ink-2 mt-2.5">{tile.body}</p>
            </Card>
          ))}
          <Card variant="band" data-reveal
            className="tile band-grid col-span-6 max-cols:col-span-2 p-tile-lead-pad grid grid-cols-[1fr_1.35fr] gap-x-12 gap-y-3 max-cols:grid-cols-1 max-cols:gap-3 items-start">
            <h3 className="text-title-lead font-bold leading-[1.15] tracking-[-.03em]">{c.title}</h3>
            <p className="text-[1.0625rem] text-band-muted mt-0">{c.body}</p>
          </Card>
        </div>
      </div>
    </section>
  );
}
