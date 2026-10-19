// The investor demo's patient camera (docs/superpowers/plans/2026-10-19-
// investor-demo.md). One presenter plays both sides of the call on one laptop,
// and their real camera is the GP's, so the patient's side sends this instead:
// an illustration labelled "Demo patient", never a photo or a face. Only the
// call hook loads it, with a dynamic import behind the build's
// `NEXT_PUBLIC_DEMO === '1'`, so it and its worker are in no bundle of the real
// site's build and no page loads them until a demo patient's call starts
// (tests/bundle-boundary.test.ts holds that no file imports it statically).
//
// It draws on the ticks of a worker clock (demoClock.worker.js), never on
// animation frames or the page's own timers: a hidden or covered window gets no
// animation frames and its timers slow to about one a second, while the GP's
// lock badge holds only while the patient's frames keep arriving (verify.ts
// wants one decoded within two seconds).

const WIDTH = 640;
const HEIGHT = 480;
const FPS = 15;
const TICK_MS = 66;
const BREATH_MS = 4_000; // one gentle rise and fall
const RISE = 6;          // pixels either way

// The brand tokens (app/globals.css), as values: a canvas cannot read a class.
const BAND = '#163300';
const SAGE = '#C9DDB8';
const STONE = '#E8E5DB';
const WHITE = '#FFFFFF';
// The site's sans stack, for when the page's own font cannot be read.
const SANS = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

// The figure sits clear of the label, and both sit inside the middle of the
// picture, which is what survives the GP's wide frame cropping top and bottom.
const CENTRE_X = WIDTH / 2;
const HEAD = { y: 196, r: 62 };
const SHOULDERS = { y: 420, rx: 116, ry: 136 };
const LABEL = { x: 24, y: 384 };

export function createDemoCamera(): { track: MediaStreamTrack; stop: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot draw the demo camera.');
  // next/font loads the page's face under a generated name; the body knows it.
  const family = getComputedStyle(document.body).fontFamily || SANS;
  const startedAt = Date.now();

  const draw = () => {
    const rise = Math.sin(((Date.now() - startedAt) / BREATH_MS) * 2 * Math.PI) * RISE;
    context.fillStyle = BAND;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = SAGE;
    context.beginPath();
    context.ellipse(CENTRE_X, SHOULDERS.y - rise, SHOULDERS.rx, SHOULDERS.ry, 0, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = STONE;
    context.beginPath();
    context.arc(CENTRE_X, HEAD.y - rise, HEAD.r, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = WHITE;
    context.font = `600 24px ${family}`;
    context.textBaseline = 'alphabetic';
    context.fillText('Demo patient', LABEL.x, LABEL.y);
  };

  // The stream first, then the clock: a canvas that cannot be captured throws
  // here, with nothing left running, and the call hook reports it unavailable.
  draw();
  const [track] = canvas.captureStream(FPS).getVideoTracks();
  if (!track) throw new Error('This browser cannot send the demo camera.');
  let clock: Worker;
  try {
    clock = new Worker(new URL('./demoClock.worker.js', import.meta.url));
  } catch (error) {
    track.stop();
    throw error;
  }
  clock.onmessage = draw;
  clock.postMessage(TICK_MS);
  return {
    track,
    stop: () => {
      clock.onmessage = null;
      clock.terminate();
      track.stop();
    },
  };
}
