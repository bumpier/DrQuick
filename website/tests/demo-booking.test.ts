// @vitest-environment jsdom
// The investor demo's centrepiece (lib/demo/booking.ts, app/dev/demo/booking,
// components/patient/useDemoBooking.ts): the patient's booking becomes the
// real waiting request the demo doctor is offered in the portal, the patient
// is matched when the doctor accepts, and lands on the outcome when the doctor
// completes.
import { StrictMode, createElement } from 'react';
import { eq, sql } from 'drizzle-orm';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { setDb, type DB } from '@/lib/db';
import { consultationOffers, consultations, gps, patients, payments } from '@/lib/db/schema';
import { AGE_BANDS, DEMO_DOCTOR, seedDoctorDemo } from '@/lib/dev/seed-doctor';
import { MAX_REQUEST_MINUTES } from '@/lib/doctor/dispatch';
import { acceptOffer,completeConsultation, declineOffer, goOnline, pulse, shiftState } from '@/lib/doctor/shift';
import { splitPrice } from '@/lib/finance/commission';
import { COMPLAINTS } from '@/lib/booking';
import { bookingReducer, initialBooking, type BookingAction, type BookingState } from '@/lib/booking-flow';
import { DEMO_PATIENT_EMAIL, cancelDemoRequest, createDemoRequest, demoRequestStatus } from '@/lib/demo/booking';
import { DELETE, GET, POST } from '@/app/dev/demo/booking/route';
import { DEMO_POLL_MS, useDemoBooking } from '@/components/patient/useDemoBooking';
import { resetDb, useTestDb } from './helpers/db';

const NOW = new Date('2026-10-19T10:00:00Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
const SORE_THROAT = { complaint: 'sore-throat', pricePence: 4000, recordConsent: true } as const;

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  setDb(db);
  await resetDb(db);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
  vi.stubEnv('DATABASE_URL', '');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// The demo doctor, seeded, with nothing waiting: the seed leaves requests for
// the portal's own demo, and here the patient's request is the only one.
async function demoDoctor() {
  await seedDoctorDemo(db, NOW);
  await db.update(consultations).set({ status: 'cancelled' }).where(eq(consultations.status, 'requested'));
  const [doctor] = await db.select().from(gps).where(eq(gps.email, DEMO_DOCTOR.email));
  return doctor;
}

async function offerFor(gpId: string, now: Date) {
  const state = await shiftState(db, gpId, now);
  if (state.kind !== 'offer') throw new Error(`expected an offer, the doctor is ${state.kind}`);
  return state;
}

describe('the store', () => {
  test('writes one waiting request for the live demo patient: the stock label, a seed age band, the split, paid', async () => {
    const { consultationId } = await createDemoRequest(db, SORE_THROAT, NOW);
    const [row] = await db.select().from(consultations).where(eq(consultations.id, consultationId));
    expect(row).toMatchObject({
      status: 'requested', pricePence: 4000, ...splitPrice(4000, 0),
      reason: COMPLAINTS['sore-throat'].label, recordConsent: true, requestedAt: NOW,
    });
    expect(AGE_BANDS).toContain(row.ageBand);
    const [patient] = await db.select().from(patients).where(eq(patients.id, row.patientId));
    expect(patient.email).toBe(DEMO_PATIENT_EMAIL);
    expect(DEMO_PATIENT_EMAIL).toBe('demo-patient-live@example.com');
    const paid = await db.select().from(payments).where(eq(payments.consultationId, consultationId));
    expect(paid).toEqual([expect.objectContaining({ amountPence: 4000, status: 'succeeded' })]);
  });

  test('waits while the doctor is offline, is offered when they go online, matched on accept, completed on complete', async () => {
    const doctor = await demoDoctor();
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, NOW);
    expect(await demoRequestStatus(db, id, at(2))).toBe('waiting');
    expect(await shiftState(db, doctor.id, at(2))).toEqual({ kind: 'offline' });

    expect((await goOnline(db, doctor.id, at(4))).ok).toBe(true);
    expect(await demoRequestStatus(db, id, at(6))).toBe('waiting');
    const offer = await offerFor(doctor.id, at(6));
    expect(offer).toMatchObject({
      feePence: splitPrice(4000, 0).gpFeePence, reason: COMPLAINTS['sore-throat'].label, recordConsent: true,
    });
    expect(AGE_BANDS).toContain(offer.ageBand);

    expect(await acceptOffer(db, doctor.id, offer.offerId, at(8))).toEqual({ ok: true });
    expect(await demoRequestStatus(db, id, at(10))).toBe('matched');
    expect((await completeConsultation(db, doctor.id, at(30))).ok).toBe(true);
    expect(await demoRequestStatus(db, id, at(32))).toBe('completed');
  });

  test('the patient’s poll runs the dispatcher', async () => {
    const doctor = await demoDoctor();
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, NOW);
    // Online without going through goOnline, so nothing has dispatched since.
    const ts = at(1).toISOString();
    await db.execute(sql`update gps set online_since = ${ts}::timestamptz, available_since = ${ts}::timestamptz,
      last_seen_at = ${ts}::timestamptz where id = ${doctor.id}`);
    expect((await shiftState(db, doctor.id, at(2))).kind).toBe('idle');
    expect(await demoRequestStatus(db, id, at(2))).toBe('waiting');
    expect((await shiftState(db, doctor.id, at(2))).kind).toBe('offer');
  });

  test('cancelled while offered: ended, the offer withdrawn, and the doctor idle with no offer', async () => {
    const doctor = await demoDoctor();
    await goOnline(db, doctor.id, NOW);
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, at(1));
    await offerFor(doctor.id, at(2));

    await cancelDemoRequest(db, id, at(3));
    expect(await demoRequestStatus(db, id, at(4))).toBe('ended');
    expect(await shiftState(db, doctor.id, at(4))).toMatchObject({ kind: 'idle' });
    const offers = await db.select().from(consultationOffers).where(eq(consultationOffers.consultationId, id));
    expect(offers.map((o) => o.status)).toEqual(['withdrawn']);
  });

  test('cancel is guarded: a consultation the doctor has taken is not cancelled', async () => {
    const doctor = await demoDoctor();
    await goOnline(db, doctor.id, NOW);
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, at(1));
    await acceptOffer(db, doctor.id, (await offerFor(doctor.id, at(2))).offerId, at(3));
    await cancelDemoRequest(db, id, at(4));
    expect(await demoRequestStatus(db, id, at(5))).toBe('matched');
  });

  // dispatch.ts never offers a consultation to a doctor who has had it, and
  // the demo has one doctor: once they decline or miss it, nobody can take it.
  async function consultationStatus(id: string) {
    const [row] = await db.select({ status: consultations.status }).from(consultations).where(eq(consultations.id, id));
    return row.status;
  }

  test('declined by the only doctor: ended, and cancelled so it is never offered again', async () => {
    const doctor = await demoDoctor();
    await goOnline(db, doctor.id, NOW);
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, at(1));
    expect(await declineOffer(db, doctor.id, (await offerFor(doctor.id, at(2))).offerId, at(3))).toEqual({ ok: true });

    expect(await demoRequestStatus(db, id, at(4))).toBe('ended');
    expect(await consultationStatus(id)).toBe('cancelled');
    expect(await shiftState(db, doctor.id, at(5))).toMatchObject({ kind: 'idle' });
  });

  test('a request older than the dispatcher’s limit with no live offer: ended, and cancelled', async () => {
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, NOW);
    expect(await demoRequestStatus(db, id, at(60))).toBe('waiting');
    expect(await demoRequestStatus(db, id, at((MAX_REQUEST_MINUTES + 1) * 60))).toBe('ended');
    expect(await consultationStatus(id)).toBe('cancelled');
  });

  test('an offer that runs out of time: ended, and cancelled', async () => {
    const doctor = await demoDoctor();
    await goOnline(db, doctor.id, NOW);
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, at(1));
    await offerFor(doctor.id, at(2));
    // The doctor's portal keeps polling but nobody presses Accept.
    for (const s of [10, 20, 30, 40]) await pulse(db, doctor.id, at(s));
    expect(await demoRequestStatus(db, id, at(45))).toBe('waiting');   // still inside the window
    expect(await demoRequestStatus(db, id, at(50))).toBe('ended');
    expect(await consultationStatus(id)).toBe('cancelled');
    expect(await shiftState(db, doctor.id, at(50))).toMatchObject({ kind: 'resting', reason: 'missed' });
  });

  test('an offer lost because the doctor’s window was covered (silent past 15 s): ended, driven by the patient’s poll', async () => {
    const doctor = await demoDoctor();
    await goOnline(db, doctor.id, NOW);
    const { consultationId: id } = await createDemoRequest(db, SORE_THROAT, at(1));
    await offerFor(doctor.id, at(2));
    expect(await demoRequestStatus(db, id, at(14))).toBe('waiting');
    expect(await demoRequestStatus(db, id, at(16))).toBe('ended');
    expect(await consultationStatus(id)).toBe('cancelled');
  });

  test('a second request cancels the first, and the doctor is offered the second', async () => {
    const doctor = await demoDoctor();
    await goOnline(db, doctor.id, NOW);
    const first = await createDemoRequest(db, SORE_THROAT, at(1));
    await offerFor(doctor.id, at(2));
    const second = await createDemoRequest(db, { complaint: 'skin', pricePence: 3200, recordConsent: false }, at(3));

    expect(await demoRequestStatus(db, first.consultationId, at(4))).toBe('ended');
    expect(await demoRequestStatus(db, second.consultationId, at(4))).toBe('waiting');
    expect(await offerFor(doctor.id, at(4))).toMatchObject({ reason: COMPLAINTS.skin.label, recordConsent: false });
    expect(await db.select().from(patients).where(eq(patients.email, DEMO_PATIENT_EMAIL))).toHaveLength(1);
  });

  test('an unknown or malformed id has ended, and cancelling it changes nothing', async () => {
    expect(await demoRequestStatus(db, '00000000-0000-4000-8000-000000000000', NOW)).toBe('ended');
    expect(await demoRequestStatus(db, 'nope', NOW)).toBe('ended');
    await cancelDemoRequest(db, 'nope', NOW);
  });

  test('only the live demo patient’s requests are read or cancelled', async () => {
    await seedDoctorDemo(db, NOW);
    const [other] = await db.select().from(consultations).where(eq(consultations.status, 'requested'));
    expect(await demoRequestStatus(db, other.id, at(1))).toBe('ended');
    await cancelDemoRequest(db, other.id, at(1));
    const [after] = await db.select().from(consultations).where(eq(consultations.id, other.id));
    expect(after.status).toBe('requested');
  });
});

describe('the route', () => {
  const URL_ = 'http://localhost:3100/dev/demo/booking';
  const req = (method: string, { body, query = '' }: { body?: unknown; query?: string } = {}) => new Request(`${URL_}${query}`, {
    method,
    headers: { host: 'localhost:3100', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

  test('400 on a bad body', async () => {
    for (const body of [
      { complaint: 'nope' },
      { complaint: 'nope', pricePence: 4000, recordConsent: true },
      { complaint: 'toString', pricePence: 4000, recordConsent: true },
      { complaint: 'skin', pricePence: -1, recordConsent: true },
      { complaint: 'skin', pricePence: 40.5, recordConsent: true },
      { complaint: 'skin', pricePence: 4000 },
      'not json',
    ]) {
      const res = await POST(req('POST', { body }));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(await db.select().from(consultations)).toHaveLength(0);
  });

  test('POST then GET is waiting; DELETE ends it with a 204', async () => {
    const created = await POST(req('POST', { body: { complaint: 'stomach', pricePence: 3600, recordConsent: true } }));
    expect(created.status).toBe(200);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const { consultationId } = await created.json();

    const polled = await GET(req('GET', { query: `?id=${consultationId}` }));
    expect(polled.headers.get('cache-control')).toBe('no-store');
    expect(await polled.json()).toEqual({ status: 'waiting' });

    const deleted = await DELETE(req('DELETE', { query: `?id=${consultationId}` }));
    expect(deleted.status).toBe(204);
    expect(await (await GET(req('GET', { query: `?id=${consultationId}` }))).json()).toEqual({ status: 'ended' });
  });

  test('400 without an id', async () => {
    expect((await GET(req('GET'))).status).toBe(400);
    expect((await DELETE(req('DELETE'))).status).toBe(400);
  });

  test('the guard is demoGuard’s: a 404 with the demo off, and nothing written', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    expect((await POST(req('POST', { body: SORE_THROAT }))).status).toBe(404);
    expect((await GET(req('GET', { query: '?id=00000000-0000-4000-8000-000000000000' }))).status).toBe(404);
    expect((await DELETE(req('DELETE', { query: '?id=00000000-0000-4000-8000-000000000000' }))).status).toBe(404);
    expect(await db.select().from(consultations)).toHaveLength(0);
  });
});

describe('the hook', () => {
  const T0 = NOW.getTime();
  const ID = '11111111-1111-4111-8111-111111111111';
  const run = (state: BookingState, ...actions: BookingAction[]) => actions.reduce(bookingReducer, state);
  const ANSWERS: BookingAction[] = [
    { type: 'setComplaint', complaint: 'stomach' }, { type: 'setDuration', duration: 'Today' }, { type: 'submitSymptoms' },
    { type: 'submitSafety' }, { type: 'confirmIdentity' }, { type: 'submitNhs', consent: true },
  ];
  const atQuote = () => run(initialBooking(null, { seeded: true, now: T0 }), ...ANSWERS);
  const finding = () => run(atQuote(), { type: 'authorise', now: T0 });

  let status: string;
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
  const sent = () => fetchMock.mock.calls.map(([url, init]) => ({
    method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    status = 'waiting';
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') return Response.json({ consultationId: ID });
      if (method === 'GET') return Response.json({ status });
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  // Rendered inside StrictMode by hand: renderHook's wrapper does not get
  // StrictMode's second run of a mount effect, which is the case to cover.
  function mount(initial: BookingState) {
    const act_ = vi.fn<(action: BookingAction) => void>();
    function Host({ state }: { state: BookingState }) { useDemoBooking(state, act_); return null; }
    const tree = (state: BookingState) => createElement(StrictMode, null, createElement(Host, { state }));
    const view = render(tree(initial));
    const hook = { rerender: ({ state }: { state: BookingState }) => view.rerender(tree(state)), unmount: view.unmount };
    return { act: act_, hook };
  }
  const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  test('outside demo mode nothing is sent', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    const { hook } = mount(atQuote());
    hook.rerender({ state: finding() });
    await wait(10_000);
    hook.rerender({ state: run(finding(), { type: 'cancel', id: 'C-1', date: 'd' }) });
    await wait(10_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('reaching finding with an authorised hold POSTs once, even under StrictMode', async () => {
    const { hook } = mount(atQuote());
    expect(fetchMock).not.toHaveBeenCalled();
    hook.rerender({ state: finding() });
    await flush();
    hook.rerender({ state: run(finding(), { type: 'tickQueue', now: T0 + 1_000 }) });
    await flush();
    expect(sent()).toEqual([{ method: 'POST', url: '/dev/demo/booking', body: { complaint: 'stomach', pricePence: 4000, recordConsent: true } }]);
  });

  test('mounted on finding, StrictMode’s second run of the effect makes no second request', async () => {
    mount(finding());
    await flush();
    expect(sent().map((c) => c.method)).toEqual(['POST']);
  });

  test('polls every two seconds while waiting; matched on finding becomes matchDoctor', async () => {
    const { hook, act: act_ } = mount(finding());
    await flush();
    await wait(DEMO_POLL_MS);
    expect(sent().filter((c) => c.method === 'GET')).toEqual([{ method: 'GET', url: `/dev/demo/booking?id=${ID}`, body: undefined }]);
    expect(act_).not.toHaveBeenCalled();
    status = 'matched';
    await wait(DEMO_POLL_MS);
    expect(act_).toHaveBeenCalledWith({ type: 'matchDoctor', now: expect.any(Number) });
    hook.unmount();
  });

  test('completed on the call becomes doctorCompleted, and leaving the call stops the poll', async () => {
    const { hook, act: act_ } = mount(finding());
    await flush();
    const ready = run(finding(), { type: 'matchDoctor', now: T0 + 1_000 });
    const call = run(ready, { type: 'join', now: T0 + 2_000 });
    hook.rerender({ state: ready });
    hook.rerender({ state: call });
    status = 'completed';
    await wait(DEMO_POLL_MS);
    expect(act_).toHaveBeenCalledWith({ type: 'doctorCompleted', now: expect.any(Number) });

    hook.rerender({ state: run(call, { type: 'doctorCompleted', now: T0 + 16_000 }) });
    const before = fetchMock.mock.calls.length;
    await wait(DEMO_POLL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(sent().some((c) => c.method === 'DELETE')).toBe(false);
  });

  test('a cancel from finding withdraws the request, then nothing more is sent', async () => {
    const { hook } = mount(finding());
    await flush();
    hook.rerender({ state: run(finding(), { type: 'cancel', id: 'C-1', date: 'd' }) });
    await flush();
    expect(sent().at(-1)).toEqual({ method: 'DELETE', url: `/dev/demo/booking?id=${ID}`, body: undefined });
    const before = fetchMock.mock.calls.length;
    await wait(DEMO_POLL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  test('a cancel before the POST has answered still withdraws the request it made', async () => {
    let answer: (res: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { answer = resolve; }));
    const { hook } = mount(finding());
    hook.rerender({ state: run(finding(), { type: 'cancel', id: 'C-1', date: 'd' }) });
    await flush();
    expect(sent().map((c) => c.method)).toEqual(['POST']);
    answer(Response.json({ consultationId: ID }));
    await flush();
    expect(sent().at(-1)).toEqual({ method: 'DELETE', url: `/dev/demo/booking?id=${ID}`, body: undefined });
  });

  // What the hook asked the reducer to do, applied to the screen it was on.
  const landedOn = (from: BookingState, act_: ReturnType<typeof mount>['act']) =>
    act_.mock.calls.reduce((state, [action]) => bookingReducer(state, action), from);

  test('ended while waiting (declined, missed, or a Reset): the no-GP screen, hold released, and nothing more sent', async () => {
    const { hook, act: act_ } = mount(finding());
    await flush();
    status = 'ended';
    await wait(DEMO_POLL_MS);
    const after = landedOn(finding(), act_);
    expect(after).toMatchObject({ screen: 'no-gp-available', hold: { status: 'released', amount: 40, reason: 'no-gp' } });

    hook.rerender({ state: after });
    const before = fetchMock.mock.calls.length;
    await wait(DEMO_POLL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(sent().some((c) => c.method === 'DELETE')).toBe(false);   // it has already gone
  });

  test.each([
    ['refused', () => Promise.resolve(Response.json({ error: 'invalid_body' }, { status: 400 }))],
    ['unavailable', () => Promise.resolve(Response.json({ error: 'unavailable' }, { status: 503 }))],
    ['unreachable', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as const)('a POST that is %s lands on the no-GP screen instead of waiting silently', async (_kind, reply) => {
    fetchMock.mockImplementationOnce(reply);
    const { act: act_ } = mount(finding());
    await flush();
    expect(landedOn(finding(), act_)).toMatchObject({ screen: 'no-gp-available', hold: { status: 'released' } });
    await wait(DEMO_POLL_MS * 2);
    expect(sent().map((c) => c.method)).toEqual(['POST']);
  });

  test('Try again after no GP is a new request: quoted afresh, and POSTed again', async () => {
    const { hook, act: act_ } = mount(finding());
    await flush();
    status = 'ended';
    await wait(DEMO_POLL_MS);
    const noGp = landedOn(finding(), act_);
    hook.rerender({ state: noGp });
    await flush();

    const again = run(noGp, { type: 'retry' }, { type: 'authorise', now: T0 + 60_000 });
    expect(again).toMatchObject({ screen: 'finding', hold: { status: 'authorised' } });
    status = 'waiting';
    hook.rerender({ state: again });
    await flush();
    expect(sent().filter((c) => c.method === 'POST')).toHaveLength(2);
    act_.mockClear();
    await wait(DEMO_POLL_MS);
    expect(sent().at(-1)).toMatchObject({ method: 'GET' });
    expect(act_).not.toHaveBeenCalled();
  });
});
