import type { Metadata } from 'next';
import { Covers } from '@/components/Covers';
import { Steps } from '@/components/Steps';
import { UrgentBand } from '@/components/UrgentBand';
import { Card } from '@/components/ui/card';
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
import { JoinTile, NumberedTile, PageHero, SiteSection, type Tone } from '@/components/site/PageParts';
import { GP_COVERS, GP_STEPS, PATIENT_COVERS } from '@/app/landing-content';
import { GP_CHECKS, PATIENT_JOURNEY } from './content';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'How a Dr Quick video consultation works for patients, and how a shift works for GPs.',
};

// Eight steps on a six-column grid. Spans and tones vary so no row repeats; the
// forest fill sits on "Talk by video", the payoff, as it does on the landing page.
const LAYOUT: Array<{ span: string; tone: Tone }> = [
  { span: 'col-span-4', tone: 'wash' },
  { span: 'col-span-2', tone: 'default' },
  { span: 'col-span-2', tone: 'default' },
  { span: 'col-span-2', tone: 'stone' },
  { span: 'col-span-2', tone: 'default' },
  { span: 'col-span-2', tone: 'sage' },
  { span: 'col-span-4', tone: 'band' },
  { span: 'col-span-6 max-cols:col-span-2', tone: 'wash' },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        title="How Dr Quick works."
        lead="Tell us what’s wrong, see your price in full, and talk to a GMC-registered GP by secure video — matched to the next GP who is free, not a slot in a diary."
      >
        <SegmentedLinkGroup aria-label="Jump to">
          <SegmentedLink href="#patients">For patients</SegmentedLink>
          <SegmentedLink href="#gps">For GPs</SegmentedLink>
        </SegmentedLinkGroup>
      </PageHero>
      <div className="pt-4"><UrgentBand /></div>

      <SiteSection id="patients" title="For patients.">
        <div className="grid grid-cols-6 gap-4 max-cols:grid-cols-2" data-stagger>
          {PATIENT_JOURNEY.map((tile, i) => (
            <NumberedTile key={tile.title} n={i + 1} tile={tile} tone={LAYOUT[i].tone}
              className={`${LAYOUT[i].span} max-cols:col-span-1 max-phone:col-span-2`} />
          ))}
        </div>
      </SiteSection>
      <Covers headingId="hiw-covers-title" title="What a consultation does, and doesn’t, cover." cols={PATIENT_COVERS} />

      <section id="gps" className="scroll-mt-24" aria-label="For GPs">
        <Steps headingId="hiw-gp-steps-title" title="For GPs: how a shift works." tiles={GP_STEPS} />
        <SiteSection title="Checked once, kept current." lead="Nothing is matched to you until every check is in place, and we re-check them as they fall due.">
          <Card data-reveal className="block px-tile-lead-pad py-8 max-phone:px-6">
            <ul className="grid list-none grid-cols-2 gap-x-12 max-cols:grid-cols-1">
              {GP_CHECKS.map((item) => (
                <li key={item} className="grid grid-cols-[20px_1fr] gap-3.5 border-b border-rule py-4 text-body">
                  <svg className="mt-0.75 text-primary-ink" width="20" height="20" aria-hidden="true"><use href="#i-yes" /></svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </SiteSection>
        <Covers headingId="hiw-gp-covers-title" title="What Dr Quick does, and doesn’t, do." cols={GP_COVERS} />
      </section>

      <JoinTile />
    </>
  );
}
