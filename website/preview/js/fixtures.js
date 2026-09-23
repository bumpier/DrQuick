export const PRICE = {
  amount: '£39',
  note: 'Covers the consultation and writing any prescription you need. '
      + 'The pharmacy charges separately for the medicine itself.',
};

export const PATIENT = {
  presentingComplaint: 'Sore throat and fever, three days',
  ageBand: '30–39',
  nhsGpConsent: true,
  nhsPractice: 'Example Medical Centre, London',
};

export const QUEUE = { position: 3, etaSeconds: 135 };

export const DOCTOR = {
  ref: 'GP-002',
  earningsToDate: 1248,
  consultsCompleted: 32,
  credentialsVerified: 5,
  credentialsTotal: 5,
  daysToRevalidation: 312,
  revalidationDueInDays: 18,
  shift: {
    gpsOnline: 2,
    gpsNeeded: 3,
    patientsWaiting: 4,
    minutesOnline: 42,
    earningsToday: 117,
  },
};

export const OFFER = {
  windowSeconds: 45,
  presentingComplaint: 'Sore throat and fever, three days',
  ageBand: '30–39',
  nhsGpConsent: true,
};

// The harder half of "is the pre-acceptance information enough to judge
// competence": the same offer, but the patient refused to share their NHS GP
// summary. Kept as a copy of OFFER rather than a hardcoded second screen, so
// the two offer screens cannot drift apart.
export const OFFER_CONSENT_REFUSED = { ...OFFER, nhsGpConsent: false };

const credential = (status, daysRemaining = null) => ({ status, daysRemaining });

export const GPS = [
  {
    ref: 'GP-001',
    online: true,
    credentials: {
      gmc: credential('valid', 300),
      licence: credential('valid', 300),
      cct: credential('valid', null),
      dbs: credential('valid', 200),
      rightToWork: credential('valid', null),
      indemnity: credential('valid', 180),
      revalidation: credential('valid', 400),
    },
  },
  {
    ref: 'GP-002',
    online: true,
    credentials: {
      gmc: credential('valid', 250),
      licence: credential('valid', 250),
      cct: credential('valid', null),
      dbs: credential('expiring', 12),
      rightToWork: credential('valid', null),
      indemnity: credential('expiring', 9),
      revalidation: credential('valid', 120),
    },
  },
  {
    ref: 'GP-003',
    online: false,
    credentials: {
      gmc: credential('valid', 150),
      licence: credential('valid', 150),
      cct: credential('valid', null),
      dbs: credential('valid', 90),
      rightToWork: credential('valid', null),
      indemnity: credential('expired', 0),
      revalidation: credential('valid', 60),
    },
  },
  {
    ref: 'GP-004',
    online: false,
    credentials: {
      gmc: credential('pending', null),
      licence: credential('pending', null),
      cct: credential('pending', null),
      dbs: credential('pending', null),
      rightToWork: credential('valid', null),
      indemnity: credential('pending', null),
      revalidation: credential('pending', null),
    },
  },
];

export const FLOOR = {
  waiting: 4,
  gpsOnline: 2,
  gpsNeeded: 3,
  inProgress: 2,
  offersDeclined: 3,
  offersTimedOut: 1,
  failedMatches: 1,
  noShows: 0,
};

export const GOVERNANCE = {
  incidents: 2,
  safeguarding: 1,
  redFlagEscalations: 3,
  complaints: 1,
  breakGlass: 1,
  restrictedRegister: [
    { category: 'Schedule 2 controlled drugs', status: 'Prohibited platform-wide', breaches: 0 },
    { category: 'Schedule 3 controlled drugs', status: 'Prohibited platform-wide', breaches: 0 },
    { category: 'Items needing monitoring', status: 'Records access required', breaches: 1 },
  ],
};

// Consult volume and restricted-register flags per prescriber. A platform-wide
// prohibition is only a policy until something counts breaches of it, and a
// breach is only visible per prescriber — an aggregate hides the outlier.
export const PRESCRIBING = [
  { ref: 'GP-001', consults: 45, restrictedFlagged: 0 },
  { ref: 'GP-002', consults: 40, restrictedFlagged: 1 },
  { ref: 'GP-003', consults: 35, restrictedFlagged: 0 },
  { ref: 'GP-004', consults: 0, restrictedFlagged: 0 },
];

export const BUSINESS = {
  cac: { actual: 42, assumption: 16 },
  repeatRate: { actual: 1.1, assumption: 1.8 },
  consults: 120,
  revenue: 4680,
  refunds: 3,
  waitlist: { patients: 210, gps: 34 },
};

/* ---------------------------------------------------------------------------
   Signed-in surfaces. Everything below is fake, and every figure that appears
   twice is derived once here rather than typed twice into markup.
   Today, for every screen in this prototype, is 28 August 2026.
--------------------------------------------------------------------------- */

export const TODAY = '2026-08-28';
export const FEE = 39;

export const PATIENT_ACCOUNT = {
  ref: 'PT-0148',
  initials: 'PT',
  memberSince: 'March 2026',
  identityVerified: true,
  nhsPractice: 'Example Medical Centre, London',
  nhsShareConsent: true,
  cardBrand: 'Visa',
  cardLast4: '4242',
  email: 'patient@example.com',
};

// Reasons are the patient's own words on the triage screen, never a diagnosis
// and never a medicine — this surface must not read as a clinical record.
export const CONSULTATIONS = [
  {
    id: 'C-0031', date: '12 August 2026', at: '2026-08-12', gp: 'GP-002',
    reason: 'Sore throat and fever', minutes: 9, status: 'completed', cost: FEE,
    outcome: { prescription: true, referral: false, fitNote: false, sharedWithNhsGp: true },
  },
  {
    id: 'C-0022', date: '2 July 2026', at: '2026-07-02', gp: 'GP-001',
    reason: 'Rash on forearm', minutes: 7, status: 'completed', cost: FEE,
    outcome: { prescription: false, referral: true, fitNote: false, sharedWithNhsGp: true },
  },
  {
    id: 'C-0014', date: '19 May 2026', at: '2026-05-19', gp: 'GP-003',
    reason: 'Cough lasting two weeks', minutes: 11, status: 'completed', cost: FEE,
    outcome: { prescription: true, referral: false, fitNote: true, sharedWithNhsGp: false },
  },
  {
    id: 'C-0009', date: '4 April 2026', at: '2026-04-04', gp: null,
    reason: 'Stomach pain', minutes: 0, status: 'cancelled', cost: 0, outcome: null,
  },
];

// The step a prescription is actually on, not a single status word. The
// pharmacy charge is named on every one of them: the fee covers writing the
// prescription, never the medicine.
export const PRESCRIPTIONS = [
  {
    id: 'RX-0031', consultation: 'C-0031', issued: '12 August 2026',
    pharmacy: 'Example Pharmacy, London N1',
    steps: [
      { label: 'Written by your GP', when: '12 August, 14:20', done: true },
      { label: 'Sent to your pharmacy', when: '12 August, 14:22', done: true },
      { label: 'Ready to collect', when: 'Waiting on the pharmacy', done: false, now: true },
      { label: 'Collected', when: null, done: false },
    ],
  },
  {
    id: 'RX-0014', consultation: 'C-0014', issued: '19 May 2026',
    pharmacy: 'Example Pharmacy, London N1',
    steps: [
      { label: 'Written by your GP', when: '19 May, 09:40', done: true },
      { label: 'Sent to your pharmacy', when: '19 May, 09:41', done: true },
      { label: 'Ready to collect', when: '19 May, 16:05', done: true },
      { label: 'Collected', when: '20 May, 11:12', done: true },
    ],
  },
];

/* Doctor dashboard. Consults are the unit; earnings are consults × FEE, so
   the two can never contradict each other on the same screen. */

export const DOCTOR_DASHBOARD = {
  initials: 'GP',
  ratingAverage: 4.8,
  ratingCount: 96,
  acceptanceRate: 0.86,
  averageConsultMinutes: 9,
  // 15–28 August 2026, one entry per day, ending today.
  dailyConsults: [
    { label: '15', consults: 1 }, { label: '16', consults: 2 }, { label: '17', consults: 0 },
    { label: '18', consults: 3 }, { label: '19', consults: 2 }, { label: '20', consults: 1 },
    { label: '21', consults: 2 }, { label: '22', consults: 0 }, { label: '23', consults: 2 },
    { label: '24', consults: 1 }, { label: '25', consults: 3 }, { label: '26', consults: 1 },
    { label: '27', consults: 2 }, { label: '28', consults: 3 },
  ],
  // Where the floor thins: patients waiting against GPs online, by hour.
  demandByHour: [
    { hour: '07', waiting: 1, gps: 3 }, { hour: '08', waiting: 3, gps: 3 },
    { hour: '09', waiting: 4, gps: 3 }, { hour: '10', waiting: 3, gps: 3 },
    { hour: '11', waiting: 2, gps: 4 }, { hour: '12', waiting: 3, gps: 4 },
    { hour: '13', waiting: 2, gps: 4 }, { hour: '14', waiting: 2, gps: 3 },
    { hour: '15', waiting: 3, gps: 3 }, { hour: '16', waiting: 4, gps: 3 },
    { hour: '17', waiting: 6, gps: 3 }, { hour: '18', waiting: 8, gps: 3 },
    { hour: '19', waiting: 9, gps: 4 }, { hour: '20', waiting: 7, gps: 4 },
    { hour: '21', waiting: 4, gps: 2 }, { hour: '22', waiting: 2, gps: 2 },
  ],
  // A GP does not book shifts here. They go online, take offers as they come,
  // and go offline. Today's offers, and what happened to them:
  offersToday: { offered: 4, accepted: 3, declined: 1 },
  recent: [
    { id: 'C-0031', when: 'Today, 14:20', ageBand: '30–39', minutes: 9, outcome: 'Prescription issued' },
    { id: 'C-0030', when: 'Today, 13:05', ageBand: '18–29', minutes: 7, outcome: 'Advice only' },
    { id: 'C-0029', when: 'Today, 11:40', ageBand: '40–49', minutes: 12, outcome: 'Referred to NHS GP' },
    { id: 'C-0028', when: 'Yesterday, 20:15', ageBand: '5–17', minutes: 8, outcome: 'Advice only' },
    { id: 'C-0027', when: 'Yesterday, 19:02', ageBand: '60+', minutes: 14, outcome: 'Escalated to 111' },
  ],
  payout: { period: '22 – 28 August', date: 'Friday 4 September', method: 'Bank transfer' },
};
