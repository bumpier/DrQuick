import { IconDefs } from '@/components/IconDefs';
import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { HeroTiles } from '@/components/PhotoTile';
import { UrgentBand } from '@/components/UrgentBand';
import { Steps } from '@/components/Steps';
import { Covers } from '@/components/Covers';
import { PriceBand } from '@/components/PriceBand';
import { Faq } from '@/components/Faq';
import { Recap } from '@/components/Recap';
import { Footer } from '@/components/Footer';
import { LandingBehavior } from '@/components/LandingBehavior';
import { WaitlistForm } from '@/components/WaitlistForm';
import { CommissionLadder } from '@/components/CommissionLadder';
import { GpSignupCta } from '@/components/GpSignupCta';
import { GpSignupDialog } from '@/components/GpSignupDialog';
import { COMMISSION_TIERS, gpSharePercent } from '@/lib/finance/commission';
import { DEFAULT_ROLE, PATIENT_MODE } from '@/lib/site-mode';
import {
  PATIENT_STEPS, PATIENT_COVERS, PATIENT_FAQ,
  GP_STEPS, GP_COVERS, GP_FAQ,
} from '@/app/landing-content';

export const dynamic = 'force-static';

// What a GP keeps to start and at the top, read from the one rule
// (lib/finance/commission.ts) so the hero and the pay tile cannot drift from it.
const START = gpSharePercent(COMMISSION_TIERS[0]);
const TOP = gpSharePercent(COMMISSION_TIERS[COMMISSION_TIERS.length - 1]);

// Section order is deliberate in each mode (CLAUDE.md): expectation-setting sits
// before the money, so the price promise and the pay promise are each read
// against a known scope. The patient price is dynamic, so its band names no
// number; a GP's share of it is fixed, so the pay band does. The footer is
// shared.
//
// The page opens on DEFAULT_ROLE (lib/site-mode.ts), and that mode comes first
// in the document, so a reader without JavaScript, and a crawler, meet the main
// audience first. PATIENT_MODE can still hold the patient mode out of the
// document entirely rather than hiding it with CSS — a mode that is not being
// offered should not be in the DOM for a crawler or a screen reader to find.
//
// The GP sign-up is a pop-up (GpSignupDialog), mounted once and opened by the
// hero, the closing band and the nav. It ends in a payment on Stripe.
export default function Page() {
  const patient = PATIENT_MODE && (
    <div className="mode" data-mode="patient">
      <Hero
        section="patient-hero"
        lines={['See a GP', 'in minutes.']}
        sub="Talk to a GMC-registered doctor by secure video. Your price is shown in full before you book, and covers any prescription you need."
        form={<WaitlistForm role="patient" source="hero" cta="Join the waitlist" inputId="join" reveal="load" />}
        art={<HeroTiles tiles={[
          { slot: 'patient-sofa-phone', tone: 'wash', glyph: 'phone' },
          { slot: 'patient-video-call', tone: 'stone', glyph: 'video' },
          { slot: 'patient-home', tone: 'sage', glyph: 'home' },
        ]} />}
      />
      <UrgentBand section="patient-urgent" />
      <Steps headingId="steps-title" section="patient-how-it-works" title="As simple as it sounds." tiles={PATIENT_STEPS} />
      <Covers headingId="covers-title" section="patient-covers" title="What a consultation does, and doesn’t, cover." cols={PATIENT_COVERS} />
      <PriceBand
        variant="price"
        headingId="price-title"
        section="patient-price"
        headline={<><b className="rounded-lg bg-white px-[.18em] font-extrabold box-decoration-clone">Your price in full,</b> before you book.</>}
        fine="What you are quoted is what you pay: the price is fixed the moment you book and never changed after, with no booking fee and nothing else to pay Dr Quick afterwards."
      />
      <Faq headingId="faq-title" section="patient-faq" title="Questions people ask." items={PATIENT_FAQ} />
      <Recap
        headingId="recap-title"
        section="patient-closing"
        title="Be first through the door."
        sub="GMC-registered GPs by secure video, with your price shown in full before you book. England at launch."
        form={<WaitlistForm role="patient" source="recap" cta="Join the waitlist" inputId="join2" reveal="" />}
      />
    </div>
  );

  const gp = (
    <div className="mode" data-mode="gp">
      <Hero
        headerId="gps"
        section="gp-hero"
        lines={['Consult when', 'it suits you.']}
        sub={`Keep ${START}% of every consultation, rising to ${TOP}%. No minimum hours and no retainer, by secure video from wherever you are.`}
        form={<GpSignupCta source="hero-gp" id="gp-join" reveal="load" more={{ href: '#gp-pay-title', label: 'See what you keep' }} />}
        art={<HeroTiles tiles={[
          { slot: 'gp-home-laptop', tone: 'wash', glyph: 'laptop' },
          { slot: 'gp-video-consult', tone: 'sage', glyph: 'video' },
          { slot: 'gp-notes', tone: 'stone', glyph: 'chat' },
        ]} />}
      />
      <Steps headingId="gp-steps-title" section="gp-shift" title="How a shift works." tiles={GP_STEPS} />
      <Covers headingId="gp-covers-title" section="gp-scope" title="What Dr Quick does, and doesn’t, do." cols={GP_COVERS} />
      <PriceBand
        variant="pay"
        headingId="gp-pay-title"
        section="gp-pay"
        headline={<>Keep {START}% of every consultation, <b className="text-primary-lift font-extrabold">rising to {TOP}%.</b></>}
        fine="Your share of the price the patient pays, rising with the consultations you complete. What a consultation pays is shown in full before you accept it, and it is more when demand is high. No minimum hours and no retainer."
        aside={<CommissionLadder />}
      />
      <Faq headingId="gp-faq-title" section="gp-faq" title="Questions GPs ask." items={GP_FAQ} />
      <Recap
        headingId="gp-recap-title"
        section="gp-closing"
        title="Be first on the rota."
        sub="Paid per consultation, on the hours you choose. Patients in England at launch."
        form={<GpSignupCta source="recap-gp" id="gp-join2" reveal="" />}
      />
    </div>
  );

  return (
    <>
      <IconDefs />
      <a className="skip" href="#main">Skip to content</a>
      <span id="nav-sentinel" aria-hidden="true" />
      <Nav />
      <main id="main">
        {DEFAULT_ROLE === 'gp' ? <>{gp}{patient}</> : <>{patient}{gp}</>}
      </main>
      <Footer />
      <GpSignupDialog />
      <LandingBehavior />
    </>
  );
}
