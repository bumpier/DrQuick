import { test, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('siteUrl falls back to localhost outside production', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  const { siteUrl } = await import('@/lib/site-url');
  expect(siteUrl().origin).toBe('http://localhost:3000');
});

test('siteUrl throws loudly in a production build with no domain set', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  const { siteUrl } = await import('@/lib/site-url');
  expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
});

test('siteUrl uses the configured origin', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://drquick.example');
  const { siteUrl } = await import('@/lib/site-url');
  expect(siteUrl().href).toBe('https://drquick.example/');
});

test('the metadata ports the flat page head: share card, icons, locale', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://drquick.example');
  vi.doMock('next/font/google', () => ({
    Plus_Jakarta_Sans: () => ({ variable: '--font-jakarta', className: '' }),
  }));
  const { PATIENT_MODE } = await import('@/lib/site-mode');
  const { metadata, viewport } = await import('@/app/layout');
  // The head describes whichever audience actually ships. With only the GP mode
  // live, a patient title would promise a page no one can reach.
  if (PATIENT_MODE) {
    expect(metadata.title).toBe('Dr Quick — See a GP in minutes');
    expect(metadata.description).toContain('Your price shown in full before you book');
    expect(metadata.openGraph!.title).toBe('See a GP in minutes.');
  } else {
    expect(metadata.title).toBe('Dr Quick — Consult when it suits you');
    expect(metadata.description).toContain('Paid per consultation');
    expect(metadata.description).not.toContain('Join the waitlist');
    expect(metadata.openGraph!.title).toBe('Consult when it suits you.');
  }
  // Pricing is dynamic: no figure may reach a share card or a search result.
  for (const copy of [metadata.description, metadata.openGraph!.description, metadata.twitter!.description]) {
    expect(copy).not.toMatch(/£\d/);
  }
  expect(String(metadata.metadataBase)).toBe('https://drquick.example/');
  const og = metadata.openGraph!;
  expect(og.siteName).toBe('Dr Quick');
  expect(og.locale).toBe('en_GB');
  expect(og.images).toEqual([{ url: '/assets/og.png', width: 1200, height: 630 }]);
  expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: ['/assets/og.png'] });
  expect(metadata.icons).toMatchObject({
    icon: [
      { url: '/assets/favicon.ico', sizes: '48x48' },
      { url: '/assets/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/assets/apple-touch-icon.png',
  });
  expect(metadata.manifest).toBe('/assets/site.webmanifest');
  expect(viewport.themeColor).toBe('#F5F7F2');
});
