// @vitest-environment jsdom
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/app/doctor/(portal)/shift-actions', () => ({
  goOnlineAction: vi.fn(), goOfflineAction: vi.fn(), backOnlineAction: vi.fn(), acceptAction: vi.fn(),
  declineAction: vi.fn(), completeAction: vi.fn(), noShowAction: vi.fn(),
}));
vi.mock('@/app/doctor/actions', () => ({ signOut: vi.fn() }));
vi.mock('@/components/call/useEncryptedCall', () => ({
  useEncryptedCall: () => ({
    state: { status: 'idle', failure: null, badge: 'none', micOn: true, cameraOn: true, peerCameraOff: false, peerMicMuted: false },
    start: vi.fn(), leave: vi.fn(), toggleMic: vi.fn(), toggleCamera: vi.fn(),
    remoteVideoRef: createRef(), remoteAudioRef: createRef(), localVideoRef: createRef(),
  }),
}));
const server = vi.hoisted(() => ({ state: { kind: 'offline' } as import('@/lib/doctor/shift').ShiftState }));
vi.mock('@/lib/doctor-auth', () => ({ requireDoctor: async () => ({ id: 'd1', name: 'Dr Demo', email: 'demo@example.com' }) }));
vi.mock('@/lib/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/lib/doctor/shift', () => ({ shiftState: async () => server.state }));

import PortalLayout from '@/app/doctor/(portal)/layout';
import { ShiftPanel } from '@/components/doctor/ShiftPanel';
import { ShiftProvider } from '@/components/doctor/ShiftProvider';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { setPathname } from './helpers/next-navigation';

const CONSULTATION = {
  kind: 'consultation', consultationId: 'c1', feePence: 2880, reason: 'Sore throat, three days', ageBand: '30 to 39', elapsedMs: 252_000,
} as const;
const OFFER = {
  kind: 'offer', offerId: 'o1', feePence: 2880, reason: 'Sore throat', ageBand: '30 to 39', recordConsent: true, remainingMs: 45_000, windowSeconds: 45,
} as const;

async function layoutWith(state: typeof server.state, path: string) {
  server.state = state;
  setPathname(path);
  const ui = await PortalLayout({ children: <div data-testid="page"><div data-slot="kpi-row" /></div> });
  return render(ui);
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('the call in the portal layout', () => {
  test('on the dashboard, the call comes before the page and its KPI row', async () => {
    await layoutWith(CONSULTATION, '/doctor');
    const call = document.querySelector('[data-slot="call-panel"]')!;
    const kpis = document.querySelector('[data-slot="kpi-row"]')!;
    expect(call).toBeVisible();
    expect(call.compareDocumentPosition(kpis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Back to the consultation')).toBeNull();
  });

  test('on Earnings, a consultation bar is the first thing in main, with the call right under it', async () => {
    await layoutWith(CONSULTATION, '/doctor/earnings');
    const main = screen.getByRole('main');
    const bar = main.querySelector('[data-slot="consultation-bar"]')!;
    const content = bar.closest('div.mx-auto')!;
    expect(content.firstElementChild).toBe(bar);
    expect(bar).toHaveTextContent('Sore throat, three days');
    expect(bar).toHaveTextContent('04:');
    expect(screen.getByRole('link', { name: 'Back to the consultation' })).toHaveAttribute('href', '/doctor');
    const call = main.querySelector('[data-slot="call-panel"]')!;
    expect(bar.nextElementSibling).toBe(call);
    expect(call.compareDocumentPosition(screen.getByTestId('page')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('outside a consultation there is no bar and the call stays hidden', async () => {
    await layoutWith({ kind: 'idle', onlineMs: 0 }, '/doctor/earnings');
    expect(document.querySelector('[data-slot="consultation-bar"]')).toBeNull();
    expect(document.querySelector('[data-slot="call-panel"]')).not.toBeVisible();
  });
});

describe('the shift cards', () => {
  const panel = (state: Parameters<typeof ShiftProvider>[0]['initial']) =>
    render(<ShiftProvider initial={state}><ShiftPanel /></ShiftProvider>);

  test('the offer card carries the lime tone OfferNotice uses', () => {
    panel(OFFER);
    expect(document.querySelector('[data-slot="shift-panel"]')).toHaveClass('bg-primary');
  });

  test('the finished card shows the fee earned and how long it ran', () => {
    panel({ kind: 'resting', reason: 'finished', last: { feePence: 2880, durationMs: 600_000 } });
    expect(screen.getByText('£28.80')).toBeInTheDocument();
    expect(screen.getByText('10 min')).toBeInTheDocument();
  });

  test('a rest with no completed consultation behind it does not claim one finished', () => {
    panel({ kind: 'resting', reason: 'finished' });
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Ready when you are');
    expect(screen.queryByText('Fee earned')).toBeNull();
  });

  test('a missed offer shows no earnings', () => {
    panel({ kind: 'resting', reason: 'missed' });
    expect(screen.queryByText('Fee earned')).toBeNull();
  });
});

describe('stacked tables', () => {
  test('a stacked cell resets to left alignment below its breakpoint', () => {
    for (const [stack, bp] of [['cols', 'max-cols'], ['phone', 'max-phone']] as const) {
      const { container } = render(
        <Table stack={stack}><TableBody><TableRow><TableCell label="Fee" className="text-right">£1</TableCell></TableRow></TableBody></Table>,
      );
      expect(container.querySelector('table')!.className).toContain(`${bp}:[&_td]:text-left`);
      cleanup();
    }
  });
});
