export function formatEta(seconds: number): string {
  if (seconds < 60) return 'under a minute';
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export type Countdown = { remaining: number; expired?: boolean };
export function tickCountdown(state: Countdown): Required<Countdown> {
  const remaining = Math.max(0, state.remaining - 1);
  return { remaining, expired: remaining === 0 };
}

export type QueueState = { position: number; etaSeconds: number };
export function tickQueue(state: QueueState): QueueState {
  const etaSeconds = Math.max(0, state.etaSeconds - 1);
  const crossed = etaSeconds > 0 && etaSeconds % 45 === 0;
  const position = crossed ? Math.max(1, state.position - 1) : state.position;
  return { position, etaSeconds };
}

type TimerWindow = Pick<typeof globalThis, 'setInterval' | 'clearInterval'> & { matchMedia?: (q: string) => { matches: boolean } };

export function startInterval(fn: () => void, ms: number, win: TimerWindow = globalThis): () => void {
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced && ms < 1000) {
    fn();
    return () => {};
  }
  const id = win.setInterval(fn, ms);
  return () => win.clearInterval(id);
}
