import type { Metadata, Viewport } from 'next';
import { Geist, Inter } from 'next/font/google';
import './globals.css';
import { siteUrl } from '@/lib/site-url';
import { DEFAULT_ROLE, PATIENT_MODE } from '@/lib/site-mode';

// DESIGN.md: Geist carries the headlines, Inter the reading. Only the weights the
// page sets are loaded.
const geist = Geist({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-geist',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

// The head describes whichever audience the page is actually serving. With
// PATIENT_MODE off the only page is the GP one, so a patient title would promise
// a page that no longer exists to anyone who shares the link or finds it in a
// search result. No figure appears in either set: pricing is dynamic, and a
// number cached in a share card is a number we cannot change.
const HEAD = PATIENT_MODE
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
  icons: { icon: '/assets/favicon.svg', apple: '/assets/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Dr Quick',
    title: HEAD.social,
    description: HEAD.socialDescription,
    locale: 'en_GB',
    // DEPLOY: assets/og.png is still the patient share card ("See a GP in
    // minutes"). While PATIENT_MODE is off the card and the page disagree —
    // draw a GP card before this link is shared anywhere that matters.
    images: [{ url: '/assets/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: HEAD.social,
    description: HEAD.cardDescription,
    images: ['/assets/og.png'],
  },
};

export const viewport: Viewport = { themeColor: '#F7F9FB' };

// Resolving the role before paint means the switch never flashes the wrong page;
// without this script neither hiding rule matches and every mode in the DOM
// renders, so a blocked script cannot blank the page. With one mode shipping
// there is nothing to resolve — the role is pinned, and a stale `?role=patient`
// link cannot ask for a mode that is not in the document.
const ROLE_SCRIPT = PATIENT_MODE
  ? `(function () {
  var d = document.documentElement;
  d.classList.add('js');
  var role = 'patient';
  try {
    var q = new URLSearchParams(location.search).get('role');
    if (q === 'gp' || location.hash === '#gps' || location.hash === '#gp-join') role = 'gp';
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
    <html lang="en-GB" className={`${geist.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
