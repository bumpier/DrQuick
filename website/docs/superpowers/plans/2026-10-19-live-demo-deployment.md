# Live Demo Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The investor demo (plan 2026-10-19-investor-demo.md) runs live at https://demo.drquick.co.uk, a separate copy on the same VPS, so a presenter who is not the developer can run it from a browser with a passcode and no terminal.

**Architecture:** One codebase, two deployments. The demo deployment is a production build with two extra environment variables (`NEXT_PUBLIC_DEMO=1` at build, `DEMO_DEPLOYMENT=1` at run), its own Postgres database whose name contains `demo`, its own pm2 process bound to 127.0.0.1, and Caddy in front. A passcode gate in the proxy locks every page and route of that deployment; the demo routes trust that gate instead of the loopback check. The real site at drquick.co.uk sets neither variable and behaves exactly as today.

**Tech Stack:** Next.js 16 production build (`next build` / `next start`), proxy.ts, Postgres, pm2, Caddy, LiveKit Cloud (allowed by `LIVEKIT_CLOUD_TEST_ONLY=1`: the demo sees no patients), Vitest.

**Spec:** The user's answers on 2026-10-19: "This needs to be live on the website as the showcase. As me the developer won't be around for the showcase."; one presenter (not investors self-serving); a separate copy at demo.drquick.co.uk. Claude's call: the whole demo copy sits behind a passcode, because it hands out live video access. The earlier plan's Decisions and Global Constraints still hold except where this plan replaces them.

## Global Constraints

- `demoMode()` (lib/demo.ts) is true in exactly two cases: development with `NEXT_PUBLIC_DEMO === '1'` (unchanged), or production with `NEXT_PUBLIC_DEMO === '1'` AND `DEMO_DEPLOYMENT === '1'`. Add `demoDeployment(): boolean` (production, both flags). Read at call time.
- The real site (neither flag) must be unchanged: same pages, same headers, same 404s on every `/dev/*` route, no demo code reachable. A production build without `NEXT_PUBLIC_DEMO` must not bundle the demo camera or its worker (gate the dynamic import on `process.env.NEXT_PUBLIC_DEMO === '1'`, which Next inlines).
- Fail closed: in a demo deployment with `DEMO_PASSCODE` or `DEMO_SESSION_SECRET` missing (secret under 32 characters), every page answers 503 "Demo not configured" — never open.
- Demo data can never touch the real database: in a demo deployment, `assertLocal()` allows writes only when `DATABASE_URL`'s host is loopback AND its database name contains `demo`; otherwise it throws, as today.
- Every demo deployment response carries `X-Robots-Tag: noindex, nofollow`.
- Every new route and server action keeps the existing rules: no `$` in env values (Next expands them), fixed error codes, `Cache-Control: no-store` on anything that carries a pass or a session.
- Verify with `npx tsc --noEmit`, `npx vitest run --maxWorkers=2`, and production builds (`next build`) both with and without the demo flags. Do not start or restart servers (the session's permission check refuses it). Do not commit.

## Review Focus

1. Someone opens demo.drquick.co.uk without the passcode: every page, `/dev/call`, `/dev/demo/*`, `/doctor/*`, `/api/*` and the worker file are refused or redirected to the passcode page; nothing returns a call pass or writes data.
2. The demo deployment is misconfigured (no passcode, no secret, a database whose name lacks `demo`): it fails closed, never open, and never writes to the wrong database.
3. The real site after this change: a production build with neither flag behaves exactly as before (no gate, `/dev/*` 404, no demo chunk).
4. Passcode guessing: attempts are rate-limited per client address; a wrong and a right passcode take the same time to check.
5. The presenter's browser: the passcode is entered once; both the patient and doctor windows (same browser) share the session for 12 hours; the call works over https with the CSP in force on the patient call screen.

---

### Task 1: The demo deployment switch and its safeguards

**Files:**
- Modify: `lib/demo.ts`, `lib/dev/seed-doctor.ts` (`assertLocal`), `lib/demo/guard.ts`, `app/dev/call/route.ts`, `lib/video/calls.ts` (`devVideoCalls`, `devPatientPass`), `components/call/useEncryptedCall.ts` (import gate), `next.config.ts` (noindex all when demo deployment), `components/app/StateJumper.tsx`/`ProtoNote` only if `showPrototypeChrome` needs the new mode
- Test: `tests/demo.test.tsx`, `tests/demo-presenter.test.ts`, `tests/video-routes.test.ts` (or the file covering `/dev/call`), `tests/bundle-boundary.test.ts`

**Interfaces:**
- Produces: `demoDeployment(): boolean`; `demoMode()` per Global Constraints; `demoGuard(request)` — in a demo deployment it accepts any Host but requires the demo session (`hasDemoSession(request): boolean`, from Task 2; until Task 2 lands, a stub that returns false keeps it closed) and same-site; in development it keeps the loopback rule.
- `/dev/call`: in a demo deployment, the same demoGuard path (session + same-site + `assertLocal`); production without the deployment flag still 404.
- `devVideoCalls()`: true in development (as now) or in a demo deployment, when video is configured.

- [ ] Step 1: Failing tests: `demoMode`/`demoDeployment` matrix (dev±flag, prod±each flag); `assertLocal` in a demo deployment allows `postgres://u:p@127.0.0.1:5432/drquick_demo`, refuses `.../drquick` and a remote host; `demoGuard` in a demo deployment refuses without a session (403) and with a cross-site header, and accepts `Host: demo.drquick.co.uk` with a session; `/dev/call` in production without the flags is 404; bundle-boundary: the dynamic import of demoCamera is gated on `process.env.NEXT_PUBLIC_DEMO`.
- [ ] Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run the whole suite and `npx tsc --noEmit`, expect PASS.

### Task 2: The passcode gate

**Files:**
- Create: `lib/demo/session.ts`, `app/demo-access/page.tsx` (+ a small client form if needed), `app/demo-access/actions.ts`, `tests/demo-session.test.ts`
- Modify: `proxy.ts` (matcher widened to every path except `/_next/static`, `/_next/image`, `/favicon.*`, `/assets/*`; outside a demo deployment the proxy returns early exactly as today), `lib/demo/guard.ts` (wire `hasDemoSession`)

**Interfaces:**
- `lib/demo/session.ts`: cookie `dq_demo` (httpOnly, Secure in production, SameSite=Lax, path `/`, 12 hours), signed with `DEMO_SESSION_SECRET` through `lib/signed-token.ts`; `hasDemoSession(request: Request | NextRequest): boolean`; `demoConfigured(): boolean` (passcode set, secret ≥ 32 chars).
- `app/demo-access`: a branded page, one field "Passcode", one button "Enter demo"; a wrong passcode says "That passcode isn't right."; success redirects to `?next=` if it is a same-site path, else `/dev/demo`. Constant-time comparison (`crypto.timingSafeEqual` on SHA-256 digests); rate limit with the existing `hit()` / `hashKey()` from lib/rate-limit.ts: 10 attempts per 10 minutes per client address (from `x-forwarded-for`'s first entry, as the rest of the app reads it — find the helper).
- Proxy in a demo deployment: not configured → 503 plain "Demo not configured"; no session and path not `/demo-access` → pages redirect to `/demo-access?next=<path>`, route handlers and `/api/*` and `/dev/*` fetches answer 401 JSON `{ error: 'demo_locked' }` (tell them apart by `accept` header or by path prefix); every response gets `X-Robots-Tag: noindex, nofollow`. Keep the existing area redirects and CSP logic after the gate. The patient call screen in a demo deployment gets the strict CSP (extend `strictCsp` to `/patient` when `demoDeployment()`), with the LiveKit origin and `worker-src 'self'`.

- [ ] Step 1: Failing tests: session sign/verify/expiry/tamper; `demoConfigured` cases; the action — wrong passcode (message, no cookie), right passcode (cookie, redirect), `next` open-redirect refused (`//evil.com`, `https://evil.com`), rate limit at the 11th attempt; proxy unit tests with `NextRequest` — non-demo deployment passes through unchanged for `/`, `/dev/demo`; demo deployment without session redirects `/` and `/patient/book`, 401s `/dev/call` and `/api/waitlist`, allows `/demo-access`; misconfigured → 503; CSP present on `/patient/book/call` in a demo deployment.
- [ ] Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Whole suite + tsc, expect PASS.

### Task 3: Builds, deploy kit and the presenter's guide

**Files:**
- Modify: `scripts/deploy.sh` (start `next start` bound to `-H 127.0.0.1` when `BIND_LOCAL=1`, default unchanged for the real site; keep everything else), `.env.example` (a "Demo deployment" block: `NEXT_PUBLIC_DEMO`, `DEMO_DEPLOYMENT`, `DEMO_PASSCODE`, `DEMO_SESSION_SECRET` with the generate command, the `drquick_demo` database note, `LIVEKIT_CLOUD_TEST_ONLY=1`)
- Create: `docs/demo-deploy.md` (for the developer, once): DNS A record for `demo`; the Caddy block (`demo.drquick.co.uk { reverse_proxy 127.0.0.1:3002 }`); Postgres role and database `drquick_demo` (same pattern as docs/postgres-vps.md); a second checkout at `/var/www/drquick-demo` on the branch that carries this work; its `.env.production` (names only, never values); first deploy: `APP_DIR=/var/www/drquick-demo PM2_NAME=drquick-demo PORT=3002 BIND_LOCAL=1 BRANCH=<branch> bash scripts/deploy.sh`; seeding the demo doctor (the presenter's Reset does it); how to change the passcode; how to take the demo down (`pm2 delete drquick-demo`, remove the Caddy block).
- Modify: `docs/demo.md` — rewrite for a presenter who is not a developer: open https://demo.drquick.co.uk on Chrome on a laptop with a camera, enter the passcode, the presenter page, the checklist (Reset first; allow camera and microphone in the doctor window; two windows), the run sheet, recovery, the pricing answer, known limits. No terminal anywhere; the local `npm run demo` route moves to a short "For the developer" note at the end.
- Modify: `app/dev/demo/DemoControls.tsx` — add a "Sign out of the demo" link (clears `dq_demo`).

- [ ] Step 1: `npx tsc --noEmit`; full suite; `next build` with no demo flags (expect: no `demoCamera`/`demoClock` chunk among `.next/static/chunks` — grep the output for `demoClock` and `Demo patient`), then `NEXT_PUBLIC_DEMO=1 next build` (expect the chunk present). Delete `.next` at the end so the developer's next `npm run dev` starts clean.
- [ ] Step 2: Write the docs; review them against the code.
