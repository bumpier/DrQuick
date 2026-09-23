/* Nothing has launched. A dashboard that reads "£1,248 earned, 32
   consultations" is making a claim about a service that has not seen a single
   patient, and a prototype has no business making one. So every figure that
   could only come from the platform actually running renders as an em dash
   until there is something real behind it, and every list renders its empty
   state rather than a page of invented rows.

   Two rules, deliberately different:

   - `shown()` is for a figure that only a running platform could produce —
     earnings, volumes, waiting counts. It is a dash until the prototype is
     seeded with the demonstration data.
   - `live()` is for a figure this session can genuinely produce. A GP who
     completes a consultation really did earn what that consultation paid, and
     it must appear. It is a dash only while there is honestly nothing.

   The React surfaces read the mode from DataModeProvider (lib/data-mode.tsx)
   and bind `shown` through useFigures(); this module's own mode is for the
   unit tests and for any non-React caller. Set `?data=seeded` on any
   dashboard URL to see the screens against the fixture data. */

export const DASH = '—';

export type DataMode = 'placeholder' | 'seeded';
const MODES = new Set<DataMode>(['placeholder', 'seeded']);
let mode: DataMode = 'placeholder';

export function setDataMode(next: string): void {
  if (!MODES.has(next as DataMode)) throw new Error(`Unknown data mode: ${next}`);
  mode = next as DataMode;
}

export function dataMode(): DataMode { return mode; }
export function isSeeded(): boolean { return mode === 'seeded'; }

export type Format<T> = (value: T) => string;

/* Zero is a dash here, not a "0". "0 consultations" is a claim that the
   service ran and nobody came; a dash says only that there is nothing to
   show. Before launch those are very different sentences. */
export function live<T>(value: T | null | undefined, format: Format<T> = String as Format<T>): string {
  const nothing = value === null || value === undefined || (value as unknown) === '' || (value as unknown) === 0;
  return nothing ? DASH : format(value as T);
}

export function shown<T>(value: T | null | undefined, format: Format<T> = String as Format<T>): string {
  return isSeeded() ? live(value, format) : DASH;
}

/* A seeded list, or an empty one. Emptying the source array rather than
   guarding each render keeps the "and then a real consultation appears"
   path working: whatever this session creates is appended to the same array. */
export function seed<T>(list: readonly T[]): T[] {
  return isSeeded() ? [...list] : [];
}

export function emptyState(message: string): string {
  return `<p class="empty">${message}</p>`;
}

export function listOr(markup: string, message: string): string {
  return markup === '' ? emptyState(message) : markup;
}

/* Stamp the mode on <html> so CSS and the screenshot script can read it. Named
   `figures`, not `mode`: the landing page's `[data-mode="gp"]` rules must never
   be able to match a dashboard element. */
export function markDocument(doc: Pick<Document, 'documentElement'>): void {
  doc.documentElement.dataset.figures = mode;
}

/* Read once, at startup, so a reviewer can link straight to either mode. */
export function dataModeFromLocation(win: { location?: { search?: string }; document?: Document } = globalThis as never): DataMode {
  const raw = new URLSearchParams(win.location?.search ?? '').get('data');
  if (raw && MODES.has(raw as DataMode)) setDataMode(raw);
  if (win.document) markDocument(win.document);
  return mode;
}
