// npm run demo: the investor demo's one command. Starts the dev server with
// the demo switch on (lib/demo.ts), waits for it, then requests each page once
// so the presenter never meets a first-compile pause. Stops with the server.
import { spawn } from 'node:child_process';
import net from 'node:net';

const port = Number(process.env.PORT ?? 3100);
// The server binds to loopback only, so nothing else on the network can reach it
// (the demo guard trusts the Host header, which a remote caller can write).
// 127.0.0.1 and localhost are both loopback and secure contexts for the camera.
const base = `http://127.0.0.1:${port}`;
const presenterLink = `http://localhost:${port}/dev/demo`;

// The same order as BOOKING_STEPS in lib/booking-flow.ts (that file is
// TypeScript, so the list is repeated here).
const BOOKING_STEPS = ['symptoms', 'safety-check', 'identity', 'nhs-gp', 'quote', 'finding', 'ready', 'call', 'outcome', 'done'];

const WARM = [
  '/', '/?role=patient', '/about', '/how-it-works', '/pricing',
  '/patient?data=seeded',
  ...BOOKING_STEPS.map((s) => `/patient/book/${s}?data=seeded`),
  '/patient/consultations?data=seeded',
  '/doctor/login',
  '/dev/demo',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portInUse() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(true));
    probe.once('listening', () => probe.close(() => resolve(false)));
    probe.listen(port, '127.0.0.1');
  });
}

if (await portInUse()) {
  console.error(`Port ${port} is in use: stop the other dev server first.`);
  process.exit(1);
}

const child = spawn('npx', ['next', 'dev', '-p', String(port), '-H', '127.0.0.1'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_DEMO: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));

async function up() {
  try {
    await fetch(`${base}/`);
    return true;
  } catch {
    return false;
  }
}

while (!(await up())) await sleep(500);

const failed = [];
for (const path of WARM) {
  try {
    const res = await fetch(`${base}${path}`, { redirect: 'manual' });
    await res.arrayBuffer();
    if (res.status >= 400) {
      console.error(`Warm-up: ${path} answered ${res.status}`);
      failed.push(path);
    }
  } catch (err) {
    console.error(`Warm-up: ${path} failed: ${err.message}`);
    failed.push(path);
  }
}

console.log(failed.length
  ? `Demo ready, but some pages failed to load: ${failed.join(', ')}`
  : `Demo ready: ${presenterLink}`);
