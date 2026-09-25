import type { Metadata } from 'next';
import { HeroTiles } from '@/components/PhotoTile';
import { Card } from '@/components/ui/card';
import { InfoTile, JoinTile, PageHero, SiteSection } from '@/components/site/PageParts';
import { GAP, PROMISES, WONT } from './content';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'About',
  description: 'Why Dr Quick exists: patients who cannot get a GP, and GPs who cannot find enough work.',
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="Why Dr Quick exists."
        lead="Patients in England are waiting too long to see a GP. At the same time, qualified GPs can’t find enough work. Dr Quick connects the two, by secure video, in minutes."
        art={<HeroTiles tiles={[
          { slot: 'about-patient', tone: 'wash', glyph: 'phone' },
          { slot: 'about-gp', tone: 'sage', glyph: 'laptop' },
          { slot: 'about-home', tone: 'stone', glyph: 'home' },
        ]} />}
      />

      <SiteSection title="The gap we’re closing.">
        <div className="grid grid-cols-6 gap-4 max-cols:grid-cols-2" data-stagger>
          {GAP.figures.map((f, i) => (
            <Card key={f.figure} variant={f.tone} data-reveal
              className={`tile justify-between gap-10 p-tile-lead-pad ${i === 0 ? 'col-span-4' : 'col-span-2'} max-cols:col-span-1 max-phone:col-span-2`}>
              <span className={`font-display text-[clamp(3.5rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em] ${f.tone === 'band' ? 'text-primary' : 'text-primary-ink'}`}>{f.figure}</span>
              <div>
                <p className="text-lead font-semibold leading-[1.4]">{f.claim}</p>
                <p className={`text-fine mt-3 ${f.tone === 'band' ? 'text-band-muted' : 'text-ink-2'}`}>Source: {f.source}</p>
              </div>
            </Card>
          ))}
          <Card variant="sage" data-reveal className="tile col-span-4 max-cols:col-span-2 justify-center gap-4 p-tile-lead-pad">
            <blockquote className="font-display text-title-lead font-extrabold leading-[1.2] tracking-[-.03em]">“{GAP.quote.text}”</blockquote>
            <p className="text-fine text-ink-2">{GAP.quote.source}</p>
          </Card>
        </div>
      </SiteSection>

      <SiteSection title="What we promise.">
        <div className="grid grid-cols-3 gap-4 max-cols:grid-cols-2 max-phone:grid-cols-1" data-stagger>
          {PROMISES.map((p, i) => (
            <InfoTile key={p.title} title={p.title} body={p.body} tone={i === 0 ? 'lime' : i === 3 ? 'band' : 'default'}
              className={i === 0 ? 'col-span-2 max-phone:col-span-1' : undefined} />
          ))}
        </div>
      </SiteSection>

      <SiteSection title="What we won’t do.">
        <Card variant="quiet" data-reveal className="block px-tile-lead-pad py-8 max-phone:px-6">
          <ul className="grid list-none grid-cols-2 gap-x-12 max-cols:grid-cols-1">
            {WONT.map((item) => (
              <li key={item} className="grid grid-cols-[20px_1fr] gap-3.5 border-b border-rule py-4 text-body">
                <svg className="mt-0.75 text-ink-2" width="20" height="20" aria-hidden="true"><use href="#i-no" /></svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </SiteSection>

      <JoinTile />
    </>
  );
}
