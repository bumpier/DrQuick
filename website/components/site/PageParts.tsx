// The building blocks of a marketing page, in the landing page's bento grammar:
// a hero tile, headed sections of tiles, numbered step tiles and the closing
// join tile. Copy lives with each page (app/(site)/<page>/content.ts).
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// The landing hero's white tile without the capture: the page's one h1, a lead,
// optional actions, and an optional art cell beside it (HeroTiles).
export function PageHero({ title, lead, children, art }: {
  title: string; lead: string; children?: React.ReactNode; art?: React.ReactNode;
}) {
  return (
    <header className="pt-4">
      <div className={cn('wrap grid gap-4 items-stretch', art && 'grid-cols-[1.15fr_.85fr] max-cols:grid-cols-1')}>
        <div data-reveal="load" className="flex flex-col justify-center rounded-2xl bg-white shadow-card px-tile-lead-pad py-hero-t max-phone:px-6 max-phone:py-10">
          <h1 tabIndex={-1} className="max-w-[16ch]">{title}</h1>
          <p className="text-lead leading-[1.55] text-ink-2 max-w-[48ch] mt-5">{lead}</p>
          {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
        </div>
        {art}
      </div>
    </header>
  );
}

export function SiteSection({ id, title, lead, children, className }: {
  id?: string; title: string; lead?: string; children: React.ReactNode; className?: string;
}) {
  const headingId = `${id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn('pt-section scroll-mt-24', className)}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="max-w-[20ch]">{title}</h2>
        {lead && <p data-reveal className="text-lead leading-[1.55] text-ink-2 max-w-[56ch] mt-4">{lead}</p>}
        <div className="mt-heading">{children}</div>
      </div>
    </section>
  );
}

export type Tone = 'default' | 'wash' | 'sage' | 'stone' | 'quiet' | 'band' | 'lime';
export type StepTile = { title: string; body: string };

// A numbered tile. The numeral sits in a disc that contrasts with the tile tone.
export function NumberedTile({ n, tile, tone = 'default', className }: {
  n: number; tile: StepTile; tone?: Tone; className?: string;
}) {
  const band = tone === 'band';
  return (
    <Card variant={tone} data-reveal className={cn('tile justify-between gap-8 p-7', className)}>
      <span aria-hidden="true" className={cn(
        'grid size-12 place-items-center rounded-full font-display text-xl font-extrabold',
        band ? 'bg-primary text-ink' : tone === 'default' ? 'bg-lime-wash text-ink' : 'bg-white text-ink',
      )}>{n}</span>
      <div>
        <h3>{tile.title}</h3>
        <p className={cn('text-body mt-2.5', band ? 'text-band-muted' : 'text-ink-2')}>{tile.body}</p>
      </div>
    </Card>
  );
}

// A plain tile with a heading and body, for promises and facts.
export function InfoTile({ title, body, tone = 'default', className, children }: {
  title: string; body?: string; tone?: Tone; className?: string; children?: React.ReactNode;
}) {
  const band = tone === 'band';
  return (
    <Card variant={tone} data-reveal className={cn('tile block p-7', className)}>
      <h3>{title}</h3>
      {body && <p className={cn('text-body mt-2.5', band ? 'text-band-muted' : 'text-ink-2')}>{body}</p>}
      {children}
    </Card>
  );
}

// The closing tile on every page: back to the capture on the landing page, for
// each audience. The forms live only on the landing page.
export function JoinTile() {
  return (
    <section className="pt-section pb-section" aria-labelledby="join-tile-title">
      <div className="wrap">
        <div data-reveal className="rounded-2xl bg-stone px-tile-lead-pad py-field-section grid grid-cols-[1fr_auto] items-end gap-8 max-cols:grid-cols-1 max-phone:px-6">
          <div>
            <h2 id="join-tile-title" className="max-w-[16ch]">Be first through the door.</h2>
            <p className="text-lead leading-[1.55] text-ink-2 max-w-[44ch] mt-4">
              Join the waitlist and we’ll tell you when Dr Quick opens in England. GPs can sign up to be first on the rota.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><a href="/#join" data-cta="join-tile-patient">Join the waitlist</a></Button>
            <Button asChild size="lg" variant="secondary"><a href="/?role=gp#gp-join" data-cta="join-tile-gp">I’m a GP</a></Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-semibold text-primary-ink underline underline-offset-4 decoration-2 hover:text-ink">{children}</Link>;
}
