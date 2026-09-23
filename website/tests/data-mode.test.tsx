// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAt } from './helpers/render-at';
import { DataModeProvider, useDataMode, useFigures, usePersistedQuery } from '@/lib/data-mode';
import { DASH } from '@/lib/placeholder';

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Reads every hook the surfaces will read, so one render answers for the mode,
// the stamp and the figures together.
function Probe() {
  const { mode, seeded, setMode } = useDataMode();
  const figures = useFigures();
  return (
    <div>
      <output data-testid="mode">{mode}</output>
      <output data-testid="seeded">{String(seeded)}</output>
      <output data-testid="shown-zero">{figures.shown(0)}</output>
      <output data-testid="shown-three">{figures.shown(3)}</output>
      <output data-testid="shown-money">{figures.shown(39, (v) => `£${v}`)}</output>
      <output data-testid="live-one">{figures.live(1)}</output>
      <output data-testid="live-zero">{figures.live(0)}</output>
      <output data-testid="list">{figures.seedList(['GP-001', 'GP-002']).join(' ')}</output>
      <output data-testid="dash">{figures.DASH}</output>
      <button type="button" onClick={() => setMode('placeholder')}>Blank</button>
      <button type="button" onClick={() => setMode('seeded')}>Seeded</button>
    </div>
  );
}

// A second key on the same URL, the way DoctorProvider will read ?gate= (Task 13).
function GateProbe() {
  const [gate] = usePersistedQuery('gate');
  return <output data-testid="gate">{gate ?? ''}</output>;
}

const out = (id: string) => screen.getByTestId(id);
const text = (id: string) => out(id).textContent;
const stamp = () => document.documentElement.dataset.figures;
const params = () => new URLSearchParams(window.location.search);

test('every surface starts blank: no query is placeholder mode', () => {
  renderAt(<Probe />, { pathname: '/doctor', providers: DataModeProvider });
  expect(text('mode')).toBe('placeholder');
  expect(text('seeded')).toBe('false');
  expect(stamp()).toBe('placeholder');
  expect(text('shown-three')).toBe(DASH);
  expect(text('shown-money')).toBe(DASH);
  expect(out('list')).toBeEmptyDOMElement();
  expect(window.location.search).toBe('');
});

test('?data=seeded seeds the figures and stamps html[data-figures]; leaving the surface removes the stamp', () => {
  const { unmount } = renderAt(<Probe />, { pathname: '/admin', query: 'data=seeded', providers: DataModeProvider });
  expect(text('mode')).toBe('seeded');
  expect(text('seeded')).toBe('true');
  expect(stamp()).toBe('seeded');
  expect(text('shown-three')).toBe('3');
  expect(text('shown-money')).toBe('£39');
  expect(text('list')).toBe('GP-001 GP-002');
  unmount();
  expect(stamp()).toBeUndefined();
});

test('?data=demo is not a mode: the figures stay blank', () => {
  renderAt(<Probe />, { pathname: '/doctor', query: 'data=demo', providers: DataModeProvider });
  expect(text('mode')).toBe('placeholder');
  expect(stamp()).toBe('placeholder');
  expect(text('shown-three')).toBe(DASH);
});

test('nothing is written to history during mount, even under a StrictMode double-mount', () => {
  const replace = vi.spyOn(window.history, 'replaceState');
  const Strict = ({ children }: { children: ReactNode }) => (
    <StrictMode><DataModeProvider>{children}</DataModeProvider></StrictMode>
  );
  const { setPath } = renderAt(<Probe />, { pathname: '/doctor', query: 'data=seeded', providers: Strict });
  expect(text('mode')).toBe('seeded');
  expect(replace).not.toHaveBeenCalled();
  setPath('/doctor/earnings');
  expect(replace).toHaveBeenCalledTimes(1);
});

test('a client navigation drops the query and the provider stamps it back, once', () => {
  const replace = vi.spyOn(window.history, 'replaceState');
  const { setPath } = renderAt(<Probe />, { pathname: '/doctor', query: 'data=seeded', providers: DataModeProvider });
  setPath('/doctor/earnings');
  expect(window.location.pathname).toBe('/doctor/earnings');
  expect(window.location.search).toBe('?data=seeded');
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith(null, '', '/doctor/earnings?data=seeded');
  expect(text('mode')).toBe('seeded');
  // The URL already carries the mode: re-stamping is a no-op, so the router sees no restore.
  setPath('/doctor/profile?data=seeded');
  expect(replace).toHaveBeenCalledTimes(1);
  expect(window.location.search).toBe('?data=seeded');
});

test('setMode("placeholder") strips the query and setMode("seeded") writes it', () => {
  renderAt(<Probe />, { pathname: '/admin', query: 'data=seeded', providers: DataModeProvider });
  fireEvent.click(screen.getByRole('button', { name: 'Blank' }));
  expect(text('mode')).toBe('placeholder');
  expect(stamp()).toBe('placeholder');
  expect(window.location.search).toBe('');
  expect(text('shown-three')).toBe(DASH);
  fireEvent.click(screen.getByRole('button', { name: 'Seeded' }));
  expect(text('mode')).toBe('seeded');
  expect(stamp()).toBe('seeded');
  expect(window.location.search).toBe('?data=seeded');
});

test('gate= and data= coexist: each key keeps its own value through a mode change and a navigation', () => {
  const { setPath } = renderAt(<><Probe /><GateProbe /></>, {
    pathname: '/doctor', query: 'gate=indemnity-expired&data=seeded', providers: DataModeProvider,
  });
  expect(text('gate')).toBe('indemnity-expired');
  fireEvent.click(screen.getByRole('button', { name: 'Blank' }));
  expect(window.location.search).toBe('?gate=indemnity-expired');
  fireEvent.click(screen.getByRole('button', { name: 'Seeded' }));
  expect(params().get('gate')).toBe('indemnity-expired');
  expect(params().get('data')).toBe('seeded');
  setPath('/doctor/earnings');   // a <Link> drops both; both hooks stamp theirs back
  expect(params().get('gate')).toBe('indemnity-expired');
  expect(params().get('data')).toBe('seeded');
  expect(text('gate')).toBe('indemnity-expired');
});

test('useFigures: zero is the dash in both modes; live(1) shows in blank mode', () => {
  renderAt(<Probe />, { pathname: '/doctor', providers: DataModeProvider });
  expect(text('shown-zero')).toBe(DASH);
  expect(text('live-zero')).toBe(DASH);
  expect(text('live-one')).toBe('1');
  expect(text('dash')).toBe('—');
  cleanup();
  renderAt(<Probe />, { pathname: '/doctor', query: 'data=seeded', providers: DataModeProvider });
  expect(text('shown-zero')).toBe(DASH);
  expect(text('live-zero')).toBe(DASH);
  expect(text('live-one')).toBe('1');
});

test('useDataMode outside the provider is a programming error, not a silent blank', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});   // the throw is also reported; keep the run quiet
  expect(() => render(<Probe />)).toThrow('useDataMode outside DataModeProvider');
});
