// The marketing pages' nav: the wordmark home, the four page links, and one
// lime CTA to the waitlist on the landing page. Below 900px the links move
// into SiteMenu's sheet. Sticky on the ground with a hairline, like the
// landing nav once it floats.
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/Wordmark';
import { NavLinks } from './NavLinks';
import { SiteMenu } from './SiteMenu';

export function SiteNav() {
  return (
    <nav aria-label="Main" className="sticky top-0 z-10 border-b border-rule bg-white">
      <div className="wrap flex h-19 items-center gap-6 max-phone:h-16 max-phone:gap-3">
        <Link href="/" aria-label="Dr Quick, home" className="mr-auto text-2xl no-underline max-phone:text-[1.375rem]">
          <Wordmark />
        </Link>
        <NavLinks className="max-cols:hidden" />
        <Button asChild size="lg" className="max-phone:h-11 max-phone:px-4">
          <a href="/#join" data-cta="site-nav"><span className="max-phone:hidden">Join the waitlist</span><span className="phone:hidden">Join</span></a>
        </Button>
        <SiteMenu className="cols:hidden" />
      </div>
    </nav>
  );
}
