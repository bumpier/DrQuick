import type { Metadata } from 'next';
import { Covers } from '@/components/Covers';
import { Card } from '@/components/ui/card';
import { InfoTile, JoinTile, NumberedTile, PageHero, SiteSection, TextLink } from '@/components/site/PageParts';
import { PATIENT_COVERS } from '@/app/landing-content';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Your price in full before you book, held on your card, and never changed after.',
};

// Pricing is dynamic (CLAUDE.md), so this page states no figure, no range and no
// starting price. What it promises is the law the model runs under: the whole
// price before commit, never moved after, never framed as time pressure, and
// never a way to be seen ahead of someone more urgent.
const HOW_PAYING_WORKS = [
  { title: 'See your price.', body: 'The whole price, before you commit. No booking fee, and nothing added later.' },
  { title: 'Confirm, and it’s held.', body: 'The amount is held on your card, not taken.' },
  { title: 'Taken when a GP accepts.', body: 'Only once a GP has accepted your consultation.' },
  { title: 'No GP? Released in full.', body: 'If no GP is available, or you cancel before one accepts, the hold is released and nothing is charged.' },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        title="Your price, in full, before you book."
        lead="The price depends on how many GPs are free when you ask. Whatever it is, you see all of it before you commit, and it never changes after."
      />

      <SiteSection title="How paying works.">
        <div className="grid grid-cols-4 gap-4 max-cols:grid-cols-2 max-phone:grid-cols-1" data-stagger>
          {HOW_PAYING_WORKS.map((tile, i) => (
            <NumberedTile key={tile.title} n={i + 1} tile={tile} tone={i === 0 ? 'wash' : i === 3 ? 'sage' : 'default'} />
          ))}
          <Card variant="lime" data-reveal className="col-span-4 max-cols:col-span-2 max-phone:col-span-1 block px-tile-lead-pad py-10 max-phone:px-6">
            <h3 className="font-display text-title-lead font-extrabold leading-[1.15] tracking-[-.03em] max-w-[22ch]">
              What you’re quoted is what you pay. It never changes after you book.
            </h3>
          </Card>
        </div>
      </SiteSection>

      <Covers headingId="pricing-covers-title" title="What your price covers, and doesn’t." cols={PATIENT_COVERS} />

      <SiteSection title="No surprises.">
        <div className="grid grid-cols-3 gap-4 max-cols:grid-cols-1" data-stagger>
          <InfoTile tone="stone" title="The pharmacy charges separately."
            body="Your price covers the GP writing any prescription you need. You pay the pharmacy for the medicine itself, as with any private prescription." />
          <InfoTile title="No membership."
            body="No subscription and no sign-up fee. You pay per consultation, only when you need one." />
          <InfoTile title="Nobody pays to jump ahead."
            body="Paying never moves you ahead of someone more urgent. Price and clinical need are kept apart." />
        </div>
      </SiteSection>

      <SiteSection title="For GPs.">
        <Card variant="band" data-reveal className="band-grid grid grid-cols-[1.4fr_1fr] items-end gap-x-16 gap-y-6 px-tile-lead-pad py-field-section max-cols:grid-cols-1 max-phone:px-6">
          <p className="font-display text-title-lead font-extrabold leading-[1.15] tracking-[-.03em] max-w-[20ch]">
            <span className="text-primary">Paid more</span> when demand is high.
          </p>
          <p className="text-body text-band-muted max-w-[40ch]">
            Paid per consultation you take, not per hour online, and what a consultation pays is shown in full before you accept it.{' '}
            <a href="/how-it-works#gps" className="font-semibold text-white underline underline-offset-4 decoration-2 hover:text-primary">How a shift works</a>
          </p>
        </Card>
      </SiteSection>

      <p className="wrap pt-8 text-fine text-ink-2">
        Questions about pricing? <TextLink href="/contact">Get in touch</TextLink>.
      </p>
      <JoinTile />
    </>
  );
}
