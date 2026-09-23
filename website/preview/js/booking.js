/* The consultation itself: one session, carried from "See a GP now" to a
   record in the patient's history. Everything here is pure — it takes state
   and returns state, so the flow can be tested without a browser and the
   screens never have to invent a fact of their own. */

export const SECONDS_PER_PLACE = 45;

/* Ordinary presenting complaints, in the patient's own words. Never a
   diagnosis, never a medicine. The `outcome` is the decision this prototype
   simulates a GP making — it differs per complaint on purpose, because a
   consultation does not guarantee a prescription. */
export const COMPLAINTS = {
  'sore-throat': {
    label: 'Sore throat or cough',
    outcome: { prescription: true, referral: false, fitNote: false },
    note: 'Your GP has written a prescription and sent it to your pharmacy.',
  },
  stomach: {
    label: 'Stomach pain',
    outcome: { prescription: false, referral: true, fitNote: false },
    note: 'Your GP wants this looked at in person and has referred you to your NHS GP.',
  },
  skin: {
    label: 'Skin or rash',
    outcome: { prescription: false, referral: false, fitNote: false },
    note: 'Your GP gave advice and asked you to come back if it changes.',
  },
  other: {
    label: 'Something else',
    outcome: { prescription: false, referral: false, fitNote: true },
    note: 'Your GP gave advice and issued a fit note for your employer.',
  },
};

export function createBooking() {
  return {
    complaint: 'sore-throat',
    duration: '2–3 days',
    details: '',
    flags: [],
    identityVerified: false,
    practice: '',
    postcode: '',
    nhsGpConsent: null,
    card: 'ok',
    authorised: false,
    gp: null,
    seconds: 0,
  };
}

/* --- the wait ----------------------------------------------------------- */

/* One place in the queue is one GP freeing up. With two GPs on the floor a
   queue of four is two places away, not four — which is why the estimate is
   divided by the GPs actually online rather than counted head by head. */
export function waitEstimate({ waiting, gpsOnline }) {
  const gps = Math.max(1, gpsOnline);
  const position = Math.max(1, Math.ceil((waiting + 1) / gps));
  return { position, etaSeconds: position * SECONDS_PER_PLACE };
}

/* --- who can take the consultation -------------------------------------- */

/* A GP may work with a credential that is close to expiry — they may not work
   with one that has lapsed, is still pending, or was rejected. That is the
   same rule the doctor surface enforces at the point of going online. */
export function isEligibleGp(gp) {
  if (!gp.online) return false;
  return Object.values(gp.credentials).every((c) => c.status === 'valid' || c.status === 'expiring');
}

/* Least-loaded of the GPs who are eligible right now. Deterministic: ties
   break on the reference, so the same floor always matches the same GP. */
export function matchGp(gps, prescribing, booking) {
  const load = new Map(prescribing.map((row) => [row.ref, row.consults]));
  const eligible = gps.filter(isEligibleGp);
  if (eligible.length === 0) return null;

  const best = [...eligible].sort((a, b) => {
    const byLoad = (load.get(a.ref) ?? 0) - (load.get(b.ref) ?? 0);
    return byLoad !== 0 ? byLoad : a.ref.localeCompare(b.ref);
  })[0];

  return {
    ref: best.ref,
    reasons: [
      'Online and free now',
      'GMC-registered with a licence to practise',
      'Every credential in date',
      'Fewest consultations on shift today',
    ],
    limitedPrescribing: booking?.nhsGpConsent === false,
  };
}

/* --- what came out of it ------------------------------------------------- */

/* Without the NHS record the GP cannot confirm what the patient is already
   taking, so the safe decision is to refer rather than prescribe. Refusing
   consent has to cost something here or the consent screen is theatre. */
export function outcomeFor(booking) {
  const complaint = COMPLAINTS[booking.complaint] ?? COMPLAINTS.other;
  const shared = booking.nhsGpConsent === true;
  if (!shared) {
    return {
      prescription: false,
      referral: true,
      fitNote: false,
      sharedWithNhsGp: false,
      note: 'Without your NHS record your GP could not confirm your history, '
          + 'so they referred you to your NHS GP rather than prescribing.',
    };
  }
  return { ...complaint.outcome, sharedWithNhsGp: true, note: complaint.note };
}

/* A call that ends in under two minutes did not run its course. */
export function endedEarly(seconds) {
  return seconds < 120;
}

export function nextConsultationId(existing) {
  const highest = existing.reduce((max, row) => {
    const n = Number(String(row.id).replace(/\D/g, ''));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `C-${String(highest + 1).padStart(4, '0')}`;
}

export function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/* The record the consultation leaves behind. Same shape as the fixtures, so
   the history list cannot tell a new consultation from an old one. */
export function consultationRecord(booking, { id, date, fee }) {
  const cancelled = booking.status === 'cancelled';
  return {
    id,
    date,
    at: null,
    gp: cancelled ? null : booking.gp?.ref ?? null,
    reason: COMPLAINTS[booking.complaint]?.label ?? 'Something else',
    minutes: cancelled ? 0 : Math.max(1, Math.round(booking.seconds / 60)),
    status: cancelled ? 'cancelled' : 'completed',
    cost: cancelled ? 0 : fee,
    outcome: cancelled ? null : outcomeFor(booking),
    isNew: true,
  };
}
