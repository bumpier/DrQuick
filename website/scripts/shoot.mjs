// Screenshot and click through the site in headless Edge or Chrome over the
// DevTools protocol. No dependencies: Node 24 has fetch and WebSocket built in.
//
// Why not `--window-size` and `--screenshot`: on Windows a browser window has
// a minimum width (about 500px), so a "390px" shot is a crop of a wider layout.
// Device-metrics emulation gives a true 390px layout viewport, and it can
// emulate prefers-reduced-motion, which makes every [data-reveal] visible
// without touching product code (app/globals.css forces them on under reduce).
//
// 1. Serve a production build (so the development jumper only shows with ?jumper=1):
//      NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build && npm start
// 2. Either let this script start the browser (BROWSER=<path to msedge.exe or chrome>),
//    or start one yourself and pass its port (CDP_PORT). From PowerShell:
//      Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
//        -ArgumentList "--headless=new","--remote-debugging-port=9555","--user-data-dir=$env:TEMP\edge-cdp","about:blank"
// 3. node scripts/shoot.mjs plan.json   (CDP_PORT=9555 to attach)
//
// plan.json: { "base": "http://localhost:3000", "out": "<folder>", "shots": [
//   { "name": "home-390", "path": "/patient?data=seeded", "width": 390, "height": 844,
//     "reduced": true, "noJs": false, "settle": 1200,
//     "steps": [ { "click": "See a GP now" }, { "fill": ["#details", "text"] }, { "wait": 500 },
//                { "clickSel": "css" }, { "eval": "js that returns 'ok' or true" },
//                { "expect": "visible text" }, { "expectNot": "text" }, { "shot": "name" },
//                { "key": "Tab" | "Enter" | "Space" | "ArrowDown" | "ArrowRight" | "Escape" },
//                { "type": "text into the focused field" },
//                { "tabTo": "start of the focused element's name", "max": 40 } ] } ] }
// tabTo presses Tab until the focused element's name (aria-label, text, or the
// text of the label wrapping it) starts with the given text, and logs how many
// presses it took: the keyboard walk CLAUDE.md asks for.
// Prints a JSON report: each capture's page height, path, data-screen, title and
// whether the page overflows horizontally, plus a log of every step. Console
// errors, warnings and uncaught exceptions join that log as CONSOLE lines, so a
// clean walk is one with no BAD, ERROR or CONSOLE line in it.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const planPath = process.argv[2];
if (!planPath) {
  console.error('usage: node scripts/shoot.mjs plan.json');
  process.exit(2);
}
const plan = JSON.parse(await readFile(planPath, 'utf8'));
await mkdir(plan.out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port = Number(process.env.CDP_PORT ?? 0);
let browser = null;
if (!port) {
  const exe = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  port = 9400 + Math.floor(Math.random() * 400);
  browser = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), `cdp-${port}`)}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
}

async function devtoolsUp() {
  for (let i = 0; i < 150; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return; } catch { /* not yet */ }
    await sleep(200);
  }
  throw new Error(`no DevTools endpoint on port ${port}`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
      } else if (msg.method && listeners.has(msg.method)) {
        for (const fn of listeners.get(msg.method)) fn(msg.params);
      }
    };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const n = ++id;
        pending.set(n, { res, rej });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
      once: (method, timeout = 30000) => new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`timed out waiting for ${method}`)), timeout);
        const fn = (params) => {
          clearTimeout(timer);
          listeners.set(method, (listeners.get(method) ?? []).filter((f) => f !== fn));
          res(params);
        };
        listeners.set(method, [...(listeners.get(method) ?? []), fn]);
      }),
      on: (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]),
      close: () => ws.close(),
    });
  });
}

const script = {
  click: (text) => `(() => {
    const norm = (s) => s.replace(/\\s+/g, ' ').trim();
    const want = ${JSON.stringify(text)};
    const all = [...document.querySelectorAll('button, a, label, [role=radio], [role=checkbox]')];
    const el = all.find((e) => norm(e.textContent) === want) || all.find((e) => norm(e.textContent).startsWith(want));
    if (!el) return 'MISSING: ' + want;
    el.click();
    return 'ok';
  })()`,
  clickSel: (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'MISSING: ' + ${JSON.stringify(sel)}; el.click(); return 'ok'; })()`,
  fill: (sel, value) => `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return 'MISSING: ' + ${JSON.stringify(sel)};
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`,
  has: (text) => `document.body.innerText.includes(${JSON.stringify(text)})`,
};

const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: String.fromCharCode(13) },
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
};
async function press(page, name) {
  const k = KEYS[name];
  await page.send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', ...k });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode });
}
const FOCUS_NAME = String.raw`(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return '(body)';
  const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
  return t(el.getAttribute('aria-label')) || t(el.textContent) || t(el.closest('label')?.textContent) || t(el.getAttribute('placeholder')) || el.id || el.tagName;
})()`;

const report = [];
async function capture(page, shot, name) {
  const { result } = await page.send('Runtime.evaluate', {
    expression: `JSON.stringify({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, path: location.pathname + location.search, screen: document.querySelector('[data-screen]')?.dataset.screen ?? null, title: document.title })`,
    returnByValue: true,
  });
  const m = JSON.parse(result.value);
  const png = await page.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: shot.width, height: Math.min(m.h, 9000), scale: 1 },
  });
  await writeFile(path.join(plan.out, `${name}.png`), Buffer.from(png.data, 'base64'));
  report.push({ name, ...m, overflow: m.sw > m.iw });
}

async function run(shot) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const page = await connect(target.webSocketDebuggerUrl);
  const log = [];
  const heard = [];
  page.on('Runtime.consoleAPICalled', (p) => {
    if (!['error', 'warning', 'assert'].includes(p.type)) return;
    heard.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400)}`);
  });
  page.on('Runtime.exceptionThrown', (p) => {
    heard.push(`exception: ${(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).slice(0, 400)}`);
  });
  try {
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: shot.width, height: shot.height ?? (shot.width < 600 ? 844 : 900), deviceScaleFactor: 1, mobile: shot.width < 600,
    });
    if (shot.reduced !== false) {
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    }
    if (shot.noJs) await page.send('Emulation.setScriptExecutionDisabled', { value: true });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url: plan.base + shot.path });
    await loaded;
    await sleep(shot.settle ?? 1200);
    let captured = false;
    for (const step of shot.steps ?? []) {
      if (step.wait) { await sleep(step.wait); continue; }
      if (step.shot) { await capture(page, shot, step.shot); captured = true; continue; }
      if (step.key) { await press(page, step.key); log.push(`key ${step.key}`); await sleep(step.after ?? 250); continue; }
      if (step.type) { await page.send('Input.insertText', { text: step.type }); log.push(`typed ${JSON.stringify(step.type)}`); await sleep(step.after ?? 250); continue; }
      if (step.tabTo) {
        let found = -1;
        for (let i = 1; i <= (step.max ?? 40); i += 1) {
          await press(page, 'Tab');
          await sleep(60);
          const { result } = await page.send('Runtime.evaluate', { expression: FOCUS_NAME, returnByValue: true });
          if (String(result.value).startsWith(step.tabTo)) { found = i; break; }
        }
        log.push(found > 0 ? `ok  tabTo ${JSON.stringify(step.tabTo)} -> ${found} tabs` : `BAD tabTo ${JSON.stringify(step.tabTo)} -> not reached`);
        continue;
      }
      const expression = step.click ? script.click(step.click)
        : step.clickSel ? script.clickSel(step.clickSel)
        : step.fill ? script.fill(step.fill[0], step.fill[1])
        : step.expect ? script.has(step.expect)
        : step.expectNot ? `!(${script.has(step.expectNot)})`
        : step.eval;
      const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      const value = exceptionDetails ? `EXCEPTION ${exceptionDetails.text}` : result.value;
      log.push(`${value === 'ok' || value === true ? 'ok ' : 'BAD'} ${JSON.stringify(step)} -> ${JSON.stringify(value)}`);
      await sleep(step.after ?? 350);
    }
    if (!captured && shot.name) await capture(page, shot, shot.name);
  } catch (error) {
    log.push(`ERROR ${error.message}`);
  } finally {
    page.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
  for (const line of heard) log.push(`CONSOLE ${line}`);
  return log;
}

try {
  await devtoolsUp();
  const logs = {};
  for (const shot of plan.shots) logs[shot.name ?? shot.path] = await run(shot);
  console.log(JSON.stringify({ report, logs }, null, 1));
} finally {
  browser?.kill();
}
