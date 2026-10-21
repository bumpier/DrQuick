// @vitest-environment jsdom
import { test, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));
vi.mock('../app/doctor/actions', () => ({ signIn: vi.fn() }));

import { demoDeployment, demoMode, showPrototypeChrome } from '@/lib/demo';
import { NavLinks } from '@/components/site/NavLinks';
import { Footer } from '@/components/Footer';
import { LoginForm } from '@/app/doctor/login/LoginForm';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const env = (nodeEnv: string, demo?: string, deployment?: string) => {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.stubEnv('NEXT_PUBLIC_DEMO', demo ?? '');
  vi.stubEnv('DEMO_DEPLOYMENT', deployment ?? '');
};

// The server's rule (docs/superpowers/plans/2026-10-19-live-demo-deployment.md):
// development with the flag, or the demo deployment, a production build with
// NEXT_PUBLIC_DEMO=1 run with DEMO_DEPLOYMENT=1. This file runs in jsdom, so
// the window is taken away for the server's half.
test('on the server, demoMode is development with the flag, or production with both flags', () => {
  vi.stubGlobal('window', undefined);
  const cases: Array<[string, string | undefined, string | undefined, boolean, boolean]> = [
    // NODE_ENV, NEXT_PUBLIC_DEMO, DEMO_DEPLOYMENT → demoMode, demoDeployment
    ['development', '1', undefined, true, false],
    ['development', undefined, undefined, false, false],
    ['development', undefined, '1', false, false],
    ['development', '1', '1', true, false],
    ['production', undefined, undefined, false, false],
    ['production', '1', undefined, false, false],
    ['production', undefined, '1', false, false],
    ['production', '1', '1', true, true],
    ['production', 'true', '1', false, false],
    ['production', '1', 'yes', false, false],
  ];
  for (const [nodeEnv, demo, deployment, mode, deployed] of cases) {
    env(nodeEnv, demo, deployment);
    expect([demoMode(), demoDeployment()], `${nodeEnv} ${demo} ${deployment}`).toEqual([mode, deployed]);
  }
});

// DEMO_DEPLOYMENT is a server variable, which a browser never has; there only
// the build's own flag can be read. A production build made with it serves no
// page anywhere but a demo deployment (proxy.ts answers 503), so in a browser
// the build's flag is the deployment's.
test('in the browser, demoMode in production is the build’s flag', () => {
  env('production', '1');
  expect(demoMode()).toBe(true);
  env('production');
  expect(demoMode()).toBe(false);
  env('development', '1');
  expect(demoMode()).toBe(true);
  env('development');
  expect(demoMode()).toBe(false);
});

test('showPrototypeChrome follows the jumper rule and the demo switch', () => {
  env('development');
  expect(showPrototypeChrome(null)).toBe(true);
  env('development', '1');
  expect(showPrototypeChrome(null)).toBe(false);
  expect(showPrototypeChrome('1')).toBe(true);
  env('production');
  expect(showPrototypeChrome(null)).toBe(false);
  expect(showPrototypeChrome('1')).toBe(true);
});

test('the nav lists Blog normally and drops it in demo mode', () => {
  env('development');
  const a = render(<NavLinks />);
  expect(a.container.querySelector('a[href="/blog"]')).toBeInTheDocument();
  cleanup();
  env('development', '1');
  const b = render(<NavLinks />);
  expect(b.container.querySelector('a[href="/blog"]')).toBeNull();
  expect(b.container.querySelector('a[href="/pricing"]')).toBeInTheDocument();
});

test('the login form prefills from the demo prop and is empty without it', () => {
  const a = render(<LoginForm demo={{ email: 'dr@example.test', password: 'pw-123' }} />);
  expect(a.container.querySelector<HTMLInputElement>('#email')!.value).toBe('dr@example.test');
  expect(a.container.querySelector<HTMLInputElement>('#password')!.value).toBe('pw-123');
  cleanup();
  const b = render(<LoginForm demo={null} />);
  expect(b.container.querySelector<HTMLInputElement>('#email')!.value).toBe('');
  expect(b.container.querySelector<HTMLInputElement>('#password')!.value).toBe('');
});

test('the footer lists Blog normally and drops it in demo mode', () => {
  env('development');
  const a = render(<Footer />);
  expect(a.container.querySelector('a[href="/blog"]')).toBeInTheDocument();
  cleanup();
  env('development', '1');
  const b = render(<Footer />);
  expect(b.container.querySelector('a[href="/blog"]')).toBeNull();
  expect(b.container.querySelector('a[href="/pricing"]')).toBeInTheDocument();
});

test('the login error node stays rendered, empty, for the live region', () => {
  const { container } = render(<LoginForm />);
  const err = container.querySelector('#login-error');
  expect(err).toBeInTheDocument();
  expect(err).toHaveAttribute('role', 'alert');
  expect(err).toBeEmptyDOMElement();
});
