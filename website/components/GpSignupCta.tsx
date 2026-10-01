import { Button } from '@/components/ui/button';
import { GP_FEE_LABEL, GP_FEE_REFUND } from '@/lib/gp-fee';

// The GP capture, where a four-field form used to sit: one button that opens
// the sign-up pop-up (components/GpSignupDialog.tsx listens for
// `data-gp-signup`), with the fee and its refund promise stated beside it. The
// fee is named here, before the click, so nobody meets it for the first time
// with their details already typed.
//
// Server markup with no behaviour of its own. `id` is the hash target: the nav
// CTA and the other pages link to #gp-join, which lands here without JS and
// opens the pop-up with it.
export function GpSignupCta({ source, id, reveal, more }: {
  source: 'hero-gp' | 'recap-gp';
  id: string;
  reveal?: 'load' | '';
  // An in-page link beside the button, for the hero: the pay section is where
  // the commission is explained.
  more?: { href: string; label: string };
}) {
  return (
    <div className="gp-cta" data-reveal={reveal}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button className="btn" size="lg" type="button" id={id} data-gp-signup={source} data-cta={source}>
          Sign up as a GP
        </Button>
        {more && (
          <a href={more.href} className="font-semibold text-primary-ink underline underline-offset-4 decoration-2 hover:text-ink">
            {more.label}
          </a>
        )}
      </div>
      <p className="note max-w-[46ch] text-[.9375rem]">
        <b className="font-bold text-ink">{GP_FEE_LABEL} one-off sign-up fee.</b> {GP_FEE_REFUND}
      </p>
    </div>
  );
}
