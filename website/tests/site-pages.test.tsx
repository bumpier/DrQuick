// @vitest-environment jsdom
import { test, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { installIOStub } from './helpers/io-stub';
import { nav, setPathname } from './helpers/next-navigation';

vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));

import SiteLayout from '@/app/(site)/layout';
import AboutPage from '@/app/(site)/about/page';
import HowItWorksPage from '@/app/(site)/how-it-works/page';
import PricingPage from '@/app/(site)/pricing/page';
import ContactPage from '@/app/(site)/contact/page';
import PrivacyPage from '@/app/(site)/privacy/page';
import TermsPage from '@/app/(site)/terms/page';
import { metadata as privacyMeta } from '@/app/(site)/privacy/page';
import { metadata as termsMeta } from '@/app/(site)/terms/page';
import { NAV_LINKS, FOOTER_LINKS } from '@/lib/site';

beforeEach(() => {
  cleanup();
  installIOStub();
  setPathname('/about');
});

const PAGES = [
  ['/about', AboutPage], ['/how-it-works', HowItWorksPage], ['/pricing', PricingPage],
  ['/contact', ContactPage], ['/privacy', PrivacyPage], ['/terms', TermsPage],
] as const;

test.each(PAGES)('%s renders one h1 inside the site shell, with the footer 999 link', (path, Page) => {
  setPathname(path);
  const { container } = render(<SiteLayout><Page /></SiteLayout>);
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(container.querySelector('footer a[href="tel:999"]')).toBeInTheDocument();
  expect(container.querySelector('main#main')).toBeInTheDocument();
});

test('the nav marks the current page, and the footer carries every page link', () => {
  setPathname('/pricing');
  const { container } = render(<SiteLayout><PricingPage /></SiteLayout>);
  const current = container.querySelectorAll('nav[aria-label="Main"] [aria-current="page"]');
  expect([...current].map((a) => a.getAttribute('href'))).toEqual(['/pricing']);
  const footerHrefs = [...container.querySelectorAll('footer nav a')].map((a) => a.getAttribute('href'));
  expect(footerHrefs).toEqual(FOOTER_LINKS.map((l) => l.href));
  expect(NAV_LINKS.every((l) => footerHrefs.includes(l.href))).toBe(true);
  expect(nav.pathname).toBe('/pricing');
});

test('a blog post counts as the Blog section in the nav', () => {
  setPathname('/blog/some-post');
  const { container } = render(<SiteLayout><div /></SiteLayout>);
  const current = container.querySelector('nav[aria-label="Main"] [aria-current="page"]');
  expect(current).toHaveAttribute('href', '/blog');
});

test('how it works keeps the 999 band and both audiences, with jump links to each', () => {
  const { container } = render(<HowItWorksPage />);
  expect(container.querySelector('.urgent a[href="tel:999"]')).toBeInTheDocument();
  expect(container.querySelector('#patients')).toBeInTheDocument();
  expect(container.querySelector('#gps')).toBeInTheDocument();
  expect([...container.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href'))).toEqual(
    expect.arrayContaining(['#patients', '#gps']));
});

test('contact puts 999 and 111 first and has no form', () => {
  const { container } = render(<ContactPage />);
  const tels = [...container.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href'));
  expect(tels.slice(0, 2)).toEqual(['tel:999', 'tel:111']);
  expect(container.querySelector('form, input, textarea')).toBeNull();
});

test('pricing states no figure, no range and no starting price', () => {
  const { container } = render(<PricingPage />);
  expect(container.textContent).not.toMatch(/£\s?\d/);
  expect(container.textContent).toMatch(/never changes after/i);
  expect(container.textContent).toMatch(/pharmacy charges separately/i);
});

test.each([['privacy', PrivacyPage, privacyMeta], ['terms', TermsPage, termsMeta]] as const)(
  '%s is a flagged, noindexed draft',
  (_name, Page, meta) => {
    const { container } = render(<Page />);
    expect(container.querySelector('[data-slot="draft-alert"]')).toHaveTextContent('Draft — not yet in force');
    expect(meta.robots).toMatchObject({ index: false });
  },
);
