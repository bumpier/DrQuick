// The demo camera's clock (demoCamera.ts): posts a tick at the pace the page
// sends it, in milliseconds. A hidden or covered window slows the page's own
// timers to about one a second; a worker's keep their pace, so the picture
// keeps its frame rate and the GP's lock badge keeps its proof.
//
// Plain JavaScript run as a classic worker, on purpose: the bundler copies the
// file referenced by `new URL(..., import.meta.url)` as it is, into
// /_next/static/media, so it must already be JavaScript (a .ts copy is served
// as video/mp2t and does not run). Same-origin, so the CSP's worker-src 'self'
// covers it, like the E2EE worker.

let timer;

addEventListener('message', (event) => {
  clearInterval(timer);
  timer = setInterval(() => postMessage('tick'), event.data);
});
