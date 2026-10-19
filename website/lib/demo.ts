// The investor demo's switch. Every value is read inside the functions, never
// at module load: Next inlines NEXT_PUBLIC_DEMO into every bundle at build time
// (next.config.ts defines it in every build, as '' when unset), and tests stub
// the environment per case.
//
// The demo runs in two places (docs/superpowers/plans/2026-10-19-live-demo-
// deployment.md): on a developer's machine (`npm run demo`, development with
// NEXT_PUBLIC_DEMO=1), and at demo.drquick.co.uk, the demo deployment: a
// production build made with NEXT_PUBLIC_DEMO=1 and run with DEMO_DEPLOYMENT=1,
// behind a passcode (proxy.ts, lib/demo/session.ts). DEMO_DEPLOYMENT is read
// when the server runs, and also at build for the prerendered pages (the
// patient prototype, the site pages), which are rendered then: so it belongs in
// the copy's .env.production, which the build reads too. The real site sets
// neither, and none of this is on there.

/** The demo deployment at demo.drquick.co.uk: production, with both flags. Server only. */
export function demoDeployment(): boolean {
  return process.env.NODE_ENV === 'production'
    && process.env.NEXT_PUBLIC_DEMO === '1'
    && process.env.DEMO_DEPLOYMENT === '1';
}

/**
 * Whether the demo is running: on a developer's machine with NEXT_PUBLIC_DEMO=1,
 * or in the demo deployment.
 *
 * In a browser only the build's own flag can be read: DEMO_DEPLOYMENT is a
 * server variable, which Next never sends to one. That is enough there, because
 * a production build made with NEXT_PUBLIC_DEMO=1 serves no page anywhere but a
 * demo deployment that is fully set up (proxy.ts answers 503 otherwise). On the
 * server, where every check that guards anything runs, both flags are read.
 */
export function demoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO !== '1') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return typeof window !== 'undefined' || process.env.DEMO_DEPLOYMENT === '1';
}

/** The prototype's own chrome (state jumper, proto notes): shown with ?jumper=1,
    or outside production unless the demo is running. */
export function showPrototypeChrome(jumper: string | null): boolean {
  if (jumper === '1') return true;
  return process.env.NODE_ENV !== 'production' && !demoMode();
}
