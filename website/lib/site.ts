// The marketing site's shared facts: its page links and its contact address.

export type SiteLink = { href: string; label: string };

// The nav carries the four pages a visitor browses; the footer carries all seven.
export const NAV_LINKS: SiteLink[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
];

export const FOOTER_LINKS: SiteLink[] = [
  ...NAV_LINKS,
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

// DEPLOY: the real enquiries address is not decided. Set NEXT_PUBLIC_CONTACT_EMAIL
// before launch; until then the placeholder is deliberately loud, like the
// og:image host, so it can never ship looking finished.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@REPLACE-WITH-PRODUCTION-DOMAIN';

export const mailto = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
