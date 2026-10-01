import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { siteUrl } from '@/lib/site-url';
import { DEFAULT_ROLE, PATIENT_MODE } from '@/lib/site-mode';
import { Analytics } from '@/components/Analytics';
import { ConsentBanner } from '@/components/ConsentBanner';

// DESIGN.md (Lime & Forest): one friendly geometric face, Plus Jakarta Sans,
// carries both the headlines and the reading. Only the weights the page sets
// are loaded.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jakarta',
});

// The head describes the audience the page opens on (DEFAULT_ROLE): the GP page
// since 2026-10-01. A patient title over a page that opens on GPs would promise
// something the reader does not land on. No figure appears in either set:
// pricing is dynamic, and a number cached in a share card is a number we cannot
// change. That goes for the GP sign-up fee and the commission too.
const HEAD = DEFAULT_ROLE === 'patient'
  ? {
      title: 'Dr Quick — See a GP in minutes',
      description:
        'See a GMC-registered GP by secure video, in minutes. Your price shown in full before you book. Join the waitlist.',
      social: 'See a GP in minutes.',
      socialDescription:
        'GMC-registered doctors by secure video. Your price shown in full before you book. Join the waitlist.',
      cardDescription: 'GMC-registered doctors by secure video. Your price shown in full before you book.',
    }
  : {
      title: 'Dr Quick — Consult when it suits you',
      description:
        'Take private GP video consultations on the hours you choose. Paid per consultation, with no minimum hours and no retainer. Sign up to be first on the rota.',
      social: 'Consult when it suits you.',
      socialDescription:
        'Private GP video consultations on the hours you choose. Paid per consultation, with no minimum hours and no retainer.',
      cardDescription:
        'Private GP video consultations on the hours you choose. Paid per consultation, no minimum hours.',
    };

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: HEAD.title,
  description: HEAD.description,
  // The favicon set is written by ../Branding/src/site.py; the favicon is the
  // logo's knob alone, because the switch is too thin to read at 16px.
  icons: {
    icon: [
      { url: '/assets/favicon.ico', sizes: '48x48' },
      { url: '/assets/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/assets/apple-touch-icon.png',
  },
  manifest: '/assets/site.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'Dr Quick',
    title: HEAD.social,
    description: HEAD.socialDescription,
    locale: 'en_GB',
    // assets/og.png is still the patient share card ("See a GP in minutes"),
    // and the page now opens on GPs, so the card and the page disagree. Draw a
    // GP card in ../Branding/src/site.py before sharing the link widely.
    images: [{ url: '/assets/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: HEAD.social,
    description: HEAD.cardDescription,
    images: ['/assets/og.png'],
  },
};

export const viewport: Viewport = { themeColor: '#F5F7F2' };

// Resolving the role before paint means the switch never flashes the wrong page;
// without this script neither hiding rule matches and every mode in the DOM
// renders, so a blocked script cannot blank the page. The page opens on
// DEFAULT_ROLE; `?role=` asks for either mode by name, and failing that a hash
// that belongs to one mode (its capture) opens that mode, so the links the other
// pages carry to #join and #gp-join land on the right audience. With one mode
// shipping there is nothing to resolve — the role is pinned, and a stale
// `?role=patient` link cannot ask for a mode that is not in the document.
const ROLE_SCRIPT = PATIENT_MODE
  ? `(function () {
  var d = document.documentElement;
  d.classList.add('js');
  var role = '${DEFAULT_ROLE}';
  try {
    var q = new URLSearchParams(location.search).get('role');
    var h = location.hash;
    if (q === 'patient' || q === 'gp') role = q;
    else if (h === '#join' || h === '#join2') role = 'patient';
    else if (h === '#gps' || h === '#gp-join') role = 'gp';
  } catch (e) {}
  d.setAttribute('data-role', role);
})();`
  : `(function () {
  var d = document.documentElement;
  d.classList.add('js');
  d.setAttribute('data-role', '${DEFAULT_ROLE}');
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-role is authored as the default so the nav CTA reads right before, and
    // without, the script: the mode-hiding rules need `.js` as well, so both
    // modes still render when it is blocked.
    <html lang="en-GB" data-role={DEFAULT_ROLE} className={jakarta.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} />
        {children}
        {/* First-party analytics and the cookie choice; both stand down on the
            admin, the prototypes and /dev (lib/analytics/track.ts). */}
        <ConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
