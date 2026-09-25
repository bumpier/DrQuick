// Shared by the landing page and every marketing page: a full-bleed forest
// block. The 999 link lives here on every page, so no page ever loses it, and
// the footer carries every page link, so nothing depends on the phone menu.
// No Storyset asset is on the page any more, so its licence attribution went
// with the illustrations; put it back if one returns.
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { FOOTER_LINKS } from '@/lib/site';

export function Footer() {
  return (
    <footer className="bg-band pt-14 pb-16 text-fine text-band-ink-2">
      <div className="wrap">
        <nav aria-label="Footer" className="mb-12">
          <ul className="flex list-none flex-wrap gap-x-8 gap-y-3 text-label font-semibold text-white">
            {FOOTER_LINKS.map(({ href, label }) => (
              <li key={href}><Link href={href} className="no-underline hover:text-primary">{label}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="wrap flex flex-wrap items-end justify-between gap-y-8 gap-x-10">
        <div>
          <p className="warn text-label font-semibold text-white tracking-[-.01em]">
            Not for emergencies — <a className="tel" href="tel:999">call 999</a> or go to A&amp;E.
          </p>
          <p className="mt-3">© 2026 Dr Quick · CQC-registered clinical service at launch · Available in England at launch</p>
        </div>
        <Wordmark className="text-3xl text-white" />
      </div>
    </footer>
  );
}
