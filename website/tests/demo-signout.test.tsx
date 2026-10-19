// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DemoControls } from '@/app/dev/demo/DemoControls';
import * as route from '@/app/dev/demo/sign-out/route';

const { POST } = route;
import { DEMO_COOKIE } from '@/lib/demo/session';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const post = (headers: Record<string, string> = {}) =>
  new Request('https://demo.drquick.co.uk/dev/demo/sign-out', { method: 'POST', headers });
const demoOn = () => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NEXT_PUBLIC_DEMO', '1'); };

describe('Sign out of the demo', () => {
  test('the sign-out button shows only in the demo deployment', () => {
    render(<DemoControls />);
    expect(screen.queryByRole('button', { name: 'Sign out of the demo' })).toBeNull();
    cleanup();
    render(<DemoControls signOut />);
    expect(screen.getByRole('button', { name: 'Sign out of the demo' })).toBeInTheDocument();
  });

  test('the button posts with fetch (the page’s CSP has form-action none) and then goes to the passcode page', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 303 }));
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const { container } = render(<DemoControls signOut />);
    expect(container.querySelector('form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of the demo' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/demo-access'));
    expect(fetchMock).toHaveBeenCalledWith('/dev/demo/sign-out', { method: 'POST' });
    vi.unstubAllGlobals();
  });

  test('there is no GET route, so a link cannot sign anyone out', () => {
    expect(Object.keys(route)).not.toContain('GET');
  });

  test('the route is a 404 unless the demo is running', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    expect((await POST(post())).status).toBe(404);
  });

  test('it clears dq_demo with the cookie’s own path and sends the presenter to the passcode page', async () => {
    demoOn();
    for (const headers of [{} as Record<string, string>, { 'sec-fetch-site': 'same-origin' }]) {
      const res = await POST(post(headers));
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('/demo-access');
      expect(res.headers.get('cache-control')).toBe('no-store');
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toContain(`${DEMO_COOKIE}=;`);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).toMatch(/Max-Age=0/i);
      expect(cookie).toMatch(/HttpOnly/i);
    }
  });

  test('a request from another site is refused and clears nothing', async () => {
    demoOn();
    for (const site of ['cross-site', 'same-site', 'none']) {
      const res = await POST(post({ 'sec-fetch-site': site }));
      expect(res.status).toBe(403);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  test('in production the clearing cookie is Secure, SameSite=Lax and on the same path', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    vi.stubEnv('DEMO_DEPLOYMENT', '1');
    vi.stubEnv('DEMO_PASSCODE', 'a-long-demo-passcode');
    vi.stubEnv('DEMO_SESSION_SECRET', 'x'.repeat(40));
    const cookie = (await POST(post({ 'sec-fetch-site': 'same-origin' }))).headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/Max-Age=0/i);
  });
});
