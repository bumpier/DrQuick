import { test, expect, describe } from 'vitest';
import nextConfig from '@/next.config';
import * as layout from '@/app/(app)/patient/layout';
import * as homePage from '@/app/(app)/patient/page';
import * as bookPage from '@/app/(app)/patient/book/[[...step]]/page';
import * as consultationsPage from '@/app/(app)/patient/consultations/page';
import * as detailPage from '@/app/(app)/patient/consultations/[id]/page';
import * as prescriptionsPage from '@/app/(app)/patient/prescriptions/page';
import * as accountPage from '@/app/(app)/patient/account/page';
import { BOOKING_SCREENS } from '@/lib/booking-flow';
import { CONSULTATIONS } from '@/lib/fixtures';

/* The patient routes as Next sees them: what the layout tells a crawler, and
   which URLs exist at build time. The page modules import client components;
   none of them touches the DOM at module scope, so they load in node. */

describe('noindex', () => {
  test('the patient layout tells robots neither to index nor to follow', () => {
    expect(layout.metadata.robots).toEqual({ index: false, follow: false });
  });

  test('the patient layout titles every page "<page> — Dr Quick"', () => {
    expect(layout.metadata.title).toMatchObject({ template: '%s — Dr Quick' });
  });

  // The header rule is covered in full by tests/headers.test.ts; this is the
  // one assertion that ties it to this surface, so the two locks sit together.
  test('the X-Robots-Tag header is the second lock on /patient/*', async () => {
    const rules = await nextConfig.headers!();
    expect(rules.find((rule) => rule.source === '/patient/:path*')?.headers)
      .toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  });
});

describe('the booking route', () => {
  test('an unlisted step is a 404, never rendered on demand: dynamicParams is false', () => {
    expect(bookPage.dynamicParams).toBe(false);
  });

  test('generateStaticParams lists the bare route as { step: [] } and each of the 16 screens once — 17 in all', () => {
    const params = bookPage.generateStaticParams();
    expect(params).toHaveLength(17);
    expect(BOOKING_SCREENS).toHaveLength(16);

    // The bare /patient/book: the key must be present and empty (a missing key throws E618 at build).
    const bare = params.filter((p) => Array.isArray(p.step) && p.step.length === 0);
    expect(bare).toEqual([{ step: [] }]);
    expect(params[0]).toEqual({ step: [] });

    for (const screen of BOOKING_SCREENS) {
      const matching = params.filter((p) => p.step.length === 1 && p.step[0] === screen);
      expect(matching, `/patient/book/${screen}`).toEqual([{ step: [screen] }]);
    }
    expect(params.every((p) => p.step.length <= 1)).toBe(true);
    expect(new Set(params.map((p) => p.step.join('/'))).size).toBe(params.length);
  });
});

describe('the consultation detail route', () => {
  test('a consultation made this session still has a page: dynamicParams is true', () => {
    expect(detailPage.dynamicParams).toBe(true);
  });

  test('generateStaticParams prerenders exactly the fixture consultations', () => {
    expect(detailPage.generateStaticParams()).toEqual(CONSULTATIONS.map(({ id }) => ({ id })));
    expect(detailPage.generateStaticParams().map(({ id }) => id)).toEqual(['C-0031', 'C-0022', 'C-0014', 'C-0009']);
  });
});

describe('every patient route is static', () => {
  test.each([
    ['layout', layout.dynamic],
    ['/patient', homePage.dynamic],
    ['/patient/book/[[...step]]', bookPage.dynamic],
    ['/patient/consultations', consultationsPage.dynamic],
    ['/patient/consultations/[id]', detailPage.dynamic],
    ['/patient/prescriptions', prescriptionsPage.dynamic],
    ['/patient/account', accountPage.dynamic],
  ])('%s is force-static', (_route, dynamic) => {
    expect(dynamic).toBe('force-static');
  });
});
