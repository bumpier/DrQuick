// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDemoCamera } from '@/components/call/demoCamera';

// The investor demo's patient picture (components/call/demoCamera.ts). One
// presenter plays both sides on one laptop, so the patient's side sends this
// instead of a camera. It must keep drawing while its window is hidden: the
// GP's lock badge holds only while the patient's frames keep decoding, and a
// hidden page's own timers slow to about one a second. So a worker keeps time.

type Drawn = { method: string; args: unknown[]; fillStyle: string };
let drawn: Drawn[];
let track: { kind: string; stop: ReturnType<typeof vi.fn> };
let videoTracks: () => unknown[];
let captured: { width: number; height: number; fps: number | undefined } | null;

// A 2D context that records every call with the fill colour at that moment.
function recordingContext() {
  const props: Record<string, unknown> = { fillStyle: '' };
  return new Proxy(props, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 12 });
      return (...args: unknown[]) => { drawn.push({ method: key, args, fillStyle: String(target.fillStyle) }); };
    },
    set(target, key: string, value) { target[key] = value; return true; },
  });
}

// The clock worker, played by the test: tick() is the worker posting a tick.
class FakeWorker {
  static made: FakeWorker[] = [];
  url: URL;
  posted: unknown[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  options: unknown;
  constructor(url: URL, options?: unknown) { this.url = url; this.options = options; FakeWorker.made.push(this); }
  postMessage(data: unknown) { this.posted.push(data); }
  terminate() { this.terminated = true; }
  tick(times = 1) {
    for (let i = 0; i < times; i++) {
      vi.advanceTimersByTime(66);
      this.onmessage?.({ data: 'tick' } as MessageEvent);
    }
  }
}
const clock = () => FakeWorker.made.at(-1)!;

const BAND = '#163300';
const SAGE = '#c9ddb8';
const STONE = '#e8e5db';
const WHITE = '#ffffff';
const labels = () => drawn.filter((d) => d.method === 'fillText' && d.args[0] === 'Demo patient');
const lower = (colour: string) => colour.toLowerCase();

beforeEach(() => {
  vi.useFakeTimers();
  drawn = [];
  captured = null;
  FakeWorker.made = [];
  track = { kind: 'video', stop: vi.fn() };
  videoTracks = () => [track];
  vi.stubGlobal('Worker', FakeWorker);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => recordingContext() as never);
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
    configurable: true,
    value: function captureStream(this: HTMLCanvasElement, fps?: number) {
      captured = { width: this.width, height: this.height, fps };
      return { getVideoTracks: () => videoTracks() };
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
});

describe('the demo patient’s camera', () => {
  test('is a 640 by 480 picture sent at 15 frames a second', () => {
    const camera = createDemoCamera();
    expect(captured).toEqual({ width: 640, height: 480, fps: 15 });
    expect(camera.track).toBe(track);
    camera.stop();
  });

  // A hidden window stops animation frames and slows its own timers; a worker's keep time.
  test('draws on each tick of a 66 ms worker clock, never on the page’s timers or animation frames', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const camera = createDemoCamera();
    expect(FakeWorker.made).toHaveLength(1);
    // Plain JavaScript, loaded as a classic worker: the bundler copies the file
    // as it is (a .ts copy would be served as video/mp2t, and not run).
    expect(clock().url.pathname).toMatch(/\/demoClock\.worker\.js$/);
    expect(clock().options).toBeUndefined();
    expect(clock().posted).toEqual([66]);
    expect(vi.getTimerCount()).toBe(0);
    const first = labels().length;
    expect(first).toBe(1);
    clock().tick(10);
    expect(labels().length).toBe(first + 10);
    expect(raf).not.toHaveBeenCalled();
    camera.stop();
  });

  test('the band behind, a figure in sage and stone, and “Demo patient” in white at the bottom left', () => {
    const camera = createDemoCamera();
    const background = drawn.find((d) => d.method === 'fillRect');
    expect(background && lower(background.fillStyle)).toBe(BAND);
    expect(background?.args).toEqual([0, 0, 640, 480]);
    const fills = new Set(drawn.filter((d) => d.method === 'fill').map((d) => lower(d.fillStyle)));
    expect(fills).toEqual(new Set([SAGE, STONE]));
    const [label] = labels();
    expect(lower(label.fillStyle)).toBe(WHITE);
    // In the bottom quarter, but clear of the edge: the GP's wide frame crops
    // the top and bottom of a 4:3 picture.
    const [, x, y] = label.args as [string, number, number];
    expect(x).toBeLessThan(64);
    expect(y).toBeGreaterThan(360);
    expect(y).toBeLessThanOrEqual(400);
    camera.stop();
  });

  test('the figure rises and falls, gently', () => {
    const camera = createDemoCamera();
    clock().tick(61); // four seconds
    const heights = drawn.filter((d) => d.method === 'arc').map((d) => d.args[1] as number);
    expect(new Set(heights).size).toBeGreaterThan(5);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(16);
    camera.stop();
  });

  test('stop() ends the clock, the drawing and the track', () => {
    const camera = createDemoCamera();
    const worker = clock();
    camera.stop();
    expect(worker.terminated).toBe(true);
    expect(track.stop).toHaveBeenCalled();
    const after = labels().length;
    worker.tick(5);
    expect(labels().length).toBe(after);
  });

  // The hook turns a throw into "unavailable"; nothing may be left running.
  test('a canvas with no picture to send throws, and starts no clock', () => {
    videoTracks = () => [];
    expect(() => createDemoCamera()).toThrow(/demo camera/);
    expect(FakeWorker.made).toHaveLength(0);

    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
      configurable: true,
      value: () => { throw new Error('not supported'); },
    });
    expect(() => createDemoCamera()).toThrow();
    expect(FakeWorker.made).toHaveLength(0);
  });

  test('a clock that cannot start stops the track before throwing', () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('refused'); } });
    expect(() => createDemoCamera()).toThrow('refused');
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('the clock worker', () => {
  // Run the way a browser runs it: the file as it is, as a classic script, with
  // only the worker's own globals. TypeScript, or an import or export, would
  // not get this far.
  test('posts a tick at the pace it is given, and restarts at a new one', () => {
    const source = readFileSync(join(__dirname, '../components/call/demoClock.worker.js'), 'utf8');
    let onMessage: ((event: { data: number }) => void) | undefined;
    const posted = vi.fn();
    new Function('addEventListener', 'postMessage', source)(
      (type: string, listener: (event: { data: number }) => void) => { if (type === 'message') onMessage = listener; },
      posted,
    );
    onMessage!({ data: 66 });
    vi.advanceTimersByTime(66 * 3);
    expect(posted).toHaveBeenCalledTimes(3);
    onMessage!({ data: 1_000 });
    vi.advanceTimersByTime(999);
    expect(posted).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1);
    expect(posted).toHaveBeenCalledTimes(4);
  });
});
