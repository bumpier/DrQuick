/* Nothing has launched. A dashboard that reads "£1,248 earned, 32
   consultations" is making a claim about a service that has not seen a single
   patient, and a prototype has no business making one. So every figure that
   could only come from the platform actually running renders as an em dash
   until there is something real behind it, and every list renders its empty
   state rather than a page of invented rows.

   Two rules, deliberately different:

   - `shown()` is for a figure that only a running platform could produce —
     earnings, volumes, ratings. It is a dash until the prototype is seeded
     with the demonstration data.
   - `live()` is for a figure this session can genuinely produce. A patient who
     walks the booking flow ends up holding a real consultation, and it must
     appear. It is a dash only while there is honestly nothing.

   Set `?data=seeded` on any preview URL, or call `setDataMode('seeded')`, to
   see the screens against the fixture data they were designed on. */

export const DASH = '—';

const MODES = new Set(['placeholder', 'seeded']);
let mode = 'placeholder';

export function setDataMode(next) {
  if (!MODES.has(next)) throw new Error(`Unknown data mode: ${next}`);
  mode = next;
}

export function dataMode() { return mode; }
export function isSeeded() { return mode === 'seeded'; }

/* Zero is a dash here, not a "0". "0 consultations" is a claim that the
   service ran and nobody came; a dash says only that there is nothing to
   show. Before launch those are very different sentences. */
export function live(value, format = String) {
  const nothing = value === null || value === undefined || value === '' || value === 0;
  return nothing ? DASH : format(value);
}

export function shown(value, format = String) {
  return isSeeded() ? live(value, format) : DASH;
}

/* A seeded list, or an empty one. Emptying the source array rather than
   guarding each render keeps the "and then a real consultation appears"
   path working: whatever this session creates is appended to the same array. */
export function seed(list) {
  return isSeeded() ? [...list] : [];
}

export function emptyState(message) {
  return `<p class="empty">${message}</p>`;
}

export function listOr(markup, message) {
  return markup === '' ? emptyState(message) : markup;
}

/* Stamp the mode on <body> so CSS can react to it — a chart legend describing
   a chart that was replaced by an empty state is a caption with no picture. */
export function markDocument(doc) {
  doc.body.dataset.mode = mode;
}

/* Read once, at startup, so a reviewer can link straight to either mode. */
export function dataModeFromLocation(win = globalThis) {
  const raw = new URLSearchParams(win.location?.search ?? '').get('data');
  if (raw && MODES.has(raw)) setDataMode(raw);
  if (win.document) markDocument(win.document);
  return mode;
}
