import { IconDefs } from '@/components/IconDefs';
import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { HeroArt } from '@/components/HeroArt';
import { UrgentBand } from '@/components/UrgentBand';
import { Steps } from '@/components/Steps';
import { Covers } from '@/components/Covers';
import { PriceBand } from '@/components/PriceBand';
import { Faq } from '@/components/Faq';
import { Recap } from '@/components/Recap';
import { Footer } from '@/components/Footer';
import { LandingBehavior } from '@/components/LandingBehavior';
import { WaitlistForm } from '@/components/WaitlistForm';
import { GpSignupForm } from '@/components/GpSignupForm';
import { PATIENT_MODE } from '@/lib/site-mode';
import {
  PATIENT_STEPS, PATIENT_COVERS, PATIENT_FAQ,
  GP_STEPS, GP_COVERS, GP_FAQ,
} from '@/app/landing-content';

export const dynamic = 'force-static';

// Section order is deliberate in each mode (CLAUDE.md): expectation-setting sits
// before the money, so the price promise and the pay promise are each read
// against a known scope. Pricing is dynamic, so neither band names a number —
// what each one promises is that the number is shown before you commit. The
// footer is shared.
//
// Both modes ship at launch. PATIENT_MODE (lib/site-mode.ts) can still hold the
// patient mode out of the document entirely rather than hiding it with CSS — a
// mode that is not being offered should not be in the DOM for a crawler or a
// screen reader to find.
export default function Page() {
  return (
    <>
      <IconDefs />
      <a className="skip" href="#main">Skip to content</a>
      <span id="nav-sentinel" aria-hidden="true" />
      <Nav />
      <main id="main">
        {PATIENT_MODE && (
        <div className="mode" data-mode="patient">
          <Hero
            lines={['See a GP', 'in minutes.']}
            sub="Talk to a GMC-registered doctor by secure video. Your price is shown in full before you book, and covers any prescription you need."
            form={<WaitlistForm role="patient" source="hero" cta="Join the waitlist" inputId="join" reveal="load" />}
            art={<HeroArt />}
          />
          <UrgentBand />
          <Steps headingId="steps-title" title="As simple as it sounds." tiles={PATIENT_STEPS} />
          <Covers headingId="covers-title" title="What a consultation does, and doesn’t, cover." cols={PATIENT_COVERS} />
          <PriceBand
            variant="price"
            headingId="price-title"
            headline={<><b className="text-primary-ink font-bold">Your price in full</b>, before you book.</>}
            fine="What you are quoted is what you pay: the price is fixed the moment you book and never changed after, with no booking fee and nothing else to pay Dr Quick afterwards."
          />
          <Faq headingId="faq-title" title="Questions people ask." items={PATIENT_FAQ} />
          <Recap
            headingId="recap-title"
            title="Be first through the door."
            sub="GMC-registered GPs by secure video, with your price shown in full before you book. England at launch."
            form={<WaitlistForm role="patient" source="recap" cta="Join the waitlist" inputId="join2" reveal="" />}
          />
        </div>
        )}

        <div className="mode" data-mode="gp">
          <Hero
            headerId="gps"
            lines={['Consult when', 'it suits you.']}
            sub="Paid per consultation, with no minimum hours and no retainer. Secure video, from wherever you are."
            form={<GpSignupForm source="hero-gp" cta="Sign up" inputId="gp-join" reveal="load" />}
            art={
              <div className="hero-img" data-reveal="load">
                {/* A plain <img>, not next/image: parity with the flat page, no optimizer in the path of an SVG. */}
                <img src="/assets/phone-illustration.svg" width={500} height={500} alt="" loading="eager" decoding="async" />
              </div>
            }
          />
          <Steps headingId="gp-steps-title" title="How a shift works." tiles={GP_STEPS} />
          <Covers headingId="gp-covers-title" title="What Dr Quick does, and doesn’t, do." cols={GP_COVERS} />
          <PriceBand
            variant="pay"
            headingId="gp-pay-title"
            headline={<><b className="text-primary-lift font-bold">Paid more</b> when demand is high.</>}
            fine="Paid per consultation you take, not per hour you are online. No minimum hours and no retainer, and what a consultation pays is shown in full before you accept it."
          />
          <Faq headingId="gp-faq-title" title="Questions GPs ask." items={GP_FAQ} />
          <Recap
            headingId="gp-recap-title"
            title="Be first on the rota."
            sub="Paid per consultation, on the hours you choose. Patients in England at launch."
            form={<GpSignupForm source="recap-gp" cta="Sign up" inputId="gp-join2" reveal="" />}
          />
        </div>
      </main>
      <Footer />
      <LandingBehavior />
    </>
  );
}
