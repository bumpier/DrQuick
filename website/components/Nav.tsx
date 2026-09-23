// Server markup; LandingBehavior wires the floating edge, the mode links and
// the CTA focus at runtime. The bar's ground, border and shadow live in the
// authored layer (flush at rest, lifted only once it floats), so the element
// carries no surface utilities. The logo's letter-spacing sits exactly at the
// -0.04em display floor. The switch is SegmentedLink — real links, never Tabs —
// and the CTA is the shared Button rendered as the anchor it always was.
//
// With PATIENT_MODE off there is one audience, so there is nothing to switch
// between: the control is not rendered, and the CTA is authored as the GP one
// rather than left to the runtime role. Without JS, `data-role` is never set,
// so a server-rendered patient CTA would show a label and an #join target that
// no longer exist on the page.
import { Button } from '@/components/ui/button';
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
import { PATIENT_MODE } from '@/lib/site-mode';

export function Nav() {
  return (
    <nav className="site-nav">
      <div className="wrap flex items-center gap-8 h-19 max-phone:gap-3.5 max-phone:h-16">
        <a className="logo font-display text-2xl max-phone:text-[1.375rem] font-bold tracking-[-.04em] no-underline mr-auto" href="#">
          Dr<span className="text-primary">Quick</span>
        </a>
        {PATIENT_MODE && (
          <SegmentedLinkGroup aria-label="Choose what you are here for">
            <SegmentedLink href="?role=patient" data-mode-link="patient" current>Patients</SegmentedLink>
            <SegmentedLink href="?role=gp" data-mode-link="gp">GPs</SegmentedLink>
          </SegmentedLinkGroup>
        )}
        {/* The phone nav shrinks the CTA a step; the form buttons keep the full size. */}
        <Button asChild size="lg" className="btn max-phone:px-4 max-phone:py-[15px]">
          {PATIENT_MODE ? (
            <a id="nav-cta" href="#join" data-focus="join">
              <span className="cta-p"><span className="cta-long">Join the waitlist</span><span className="cta-short">Join</span></span>
              <span className="cta-g"><span className="cta-long">Register interest</span><span className="cta-short">Register</span></span>
            </a>
          ) : (
            <a id="nav-cta" href="#gp-join" data-focus="gp-join">
              <span className="cta-long">Sign up</span><span className="cta-short">Sign up</span>
            </a>
          )}
        </Button>
      </div>
    </nav>
  );
}
