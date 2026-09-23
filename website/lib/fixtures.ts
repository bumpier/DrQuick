/* All fake data for the prototype's pre-launch and signed-in surfaces, in one
   file. A figure that appears twice is derived once here rather than typed
   twice into markup — the doctor dashboard and the earnings screen read the
   same numbers because they read the same export. */
import { CREDENTIAL_LABELS } from '@/lib/alerts';
import type { ConsultationRow } from '@/lib/booking';
import type { PrescriptionRow } from '@/lib/patient';

export type CredentialStatus = 'valid' | 'expiring' | 'expired' | 'pending' | 'rejected';
export type Credential = { status: CredentialStatus; daysRemaining: number | null };
export type CredentialKey = 'gmc' | 'licence' | 'cct' | 'dbs' | 'rightToWork' | 'indemnity' | 'revalidation';
export type CredentialRecord = Record<CredentialKey, Credential>;
export type Gp = { ref: string; online: boolean; credentials: CredentialRecord };
export type GateId = 'verification-pending' | 'verification-rejected' | 'indemnity-expired' | 'revalidation-due';
export type SkillId = 'general-adult' | 'minor-illness' | 'womens-health' | 'mental-health' | 'paediatrics' | 'dermatology';
export type Skill = { id: SkillId; label: string; defaultOn: boolean };
export type RecentConsult = { id: string; when: string; ageBand: string; minutes: number; outcome: string; fee: number };
export type DailyConsults = { label: string; consults: number; earnings: number };
export type DemandHour = { hour: string; waiting: number; gps: number };
export type Application = { ref: string; stage: string };

/* ---------------------------------------------------------------------------
   Signed-in surfaces. Everything below is fake, and every figure that appears
   twice is derived once here rather than typed twice into markup.
   Today, for every screen in this prototype, is 28 August 2026.

   Declaration order matters below: DAILY_CONSULTS, then GPS, then MY_RECORD,
   then FLOOR, BREAK_GLASS_LOG, GOVERNANCE, PRESCRIBING, BUSINESS, then DOCTOR
   — every derived value must read something declared above it.

   Pricing is dynamic: what a consultation costs, and what the GP taking it is
   paid, move with how many patients are waiting against how many GPs are
   online. So there is no flat fee to multiply by. Every consultation carries
   its own amount and every total below is a sum of real amounts — which is why
   a count and a sum of money can no longer be derived from one another.
--------------------------------------------------------------------------- */

export const TODAY = '2026-08-28';
export const TODAY_LABEL = '28 August 2026';

/* 15–28 August 2026, one entry per day, ending today. Fees move with demand
   through the day, so each day carries what it actually paid rather than a
   count multiplied by a rate — day 28's three consultations pay £102 while
   day 19's two pay £51. Declared here, above DOCTOR, because the shift panel
   and the dashboard chart must read today's earnings from the same row. */
const DAILY_CONSULTS: DailyConsults[] = [
  { label: '15', consults: 1, earnings: 27 }, { label: '16', consults: 2, earnings: 55 },
  { label: '17', consults: 0, earnings: 0 },  { label: '18', consults: 3, earnings: 88 },
  { label: '19', consults: 2, earnings: 51 }, { label: '20', consults: 1, earnings: 24 },
  { label: '21', consults: 2, earnings: 59 }, { label: '22', consults: 0, earnings: 0 },
  { label: '23', consults: 2, earnings: 62 }, { label: '24', consults: 1, earnings: 31 },
  { label: '25', consults: 3, earnings: 95 }, { label: '26', consults: 1, earnings: 26 },
  { label: '27', consults: 2, earnings: 57 }, { label: '28', consults: 3, earnings: 102 },
];
const TODAY_ROW = DAILY_CONSULTS[DAILY_CONSULTS.length - 1];

/* No amount here. The price a patient pays is quoted per booking, so the only
   durable thing to say about it is what it covers and when it is fixed. */
export const PRICE = {
  note: 'Your price is shown in full before you book and is never changed after. '
      + 'It covers the consultation and writing any prescription you need. '
      + 'The pharmacy charges separately for the medicine itself.',
};

export const PATIENT = {
  presentingComplaint: 'Sore throat and fever, three days',
  ageBand: '30–39',
  nhsGpConsent: true,
  nhsPractice: 'Example Medical Centre, London',
};

export const QUEUE = { position: 3, etaSeconds: 135 };

export const OFFER = {
  windowSeconds: 45,
  // What this consultation pays, shown before the GP accepts it. Under dynamic
  // pricing this is the only honest place for the number to live.
  fee: 36,
  presentingComplaint: 'Sore throat and fever, three days',
  ageBand: '30–39',
  nhsGpConsent: true,
};

// The harder half of "is the pre-acceptance information enough to judge
// competence": the same offer, but the patient refused to share their NHS GP
// summary. Kept as a copy of OFFER rather than a hardcoded second screen, so
// the two offer screens cannot drift apart.
export const OFFER_CONSENT_REFUSED = { ...OFFER, nhsGpConsent: false };

const credential = (status: CredentialStatus, daysRemaining: number | null = null): Credential => ({ status, daysRemaining });

export const GPS: Gp[] = [
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

export const MY_RECORD: CredentialRecord = GPS.find((gp) => gp.ref === 'GP-002')!.credentials;

const verified = (record: CredentialRecord) =>
  Object.values(record).filter((c) => c.status === 'valid' || c.status === 'expiring').length;

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

// Governance evidence the prototype spec names and the preview never drew.
// One row, round and synthetic; GOVERNANCE.breakGlass is derived from it.
export const BREAK_GLASS_LOG = [
  { when: '26 August, 21:14', actor: 'Admin', record: 'C-0031', reason: 'Safeguarding concern raised by GP-002' },
] as const;

export const GOVERNANCE = {
  incidents: 2,
  safeguarding: 1,
  redFlagEscalations: 3,
  reachedEmergencyScreen: 2,
  complaints: 1,
  complaintResolutionDays: 5,
  breakGlass: BREAK_GLASS_LOG.length,
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

const CONSULTS_TO_DATE = 120;

export const BUSINESS = {
  cac: { actual: 42, assumption: 16 },
  repeatRate: { actual: 1.1, assumption: 1.8 },
  consults: CONSULTS_TO_DATE,
  // Banked, not derived: 120 consultations at prices that moved with demand.
  revenue: 5_142,
  refunds: 3,
  waitlist: { patients: 210, gps: 34 },
};

const MY_PRESCRIBING = PRESCRIBING.find((gp) => gp.ref === 'GP-002')!;

export const DOCTOR = {
  ref: 'GP-002',
  consultsCompleted: MY_PRESCRIBING.consults,        // 40 — governance and "to date" cannot disagree
  earningsToDate: 1_186,                             // banked across 40 consultations, at prices that moved
  credentialsVerified: verified(MY_RECORD),
  credentialsTotal: Object.keys(MY_RECORD).length,
  daysToRevalidation: MY_RECORD.revalidation.daysRemaining,
  // The revalidation-due gate exists to show the warning, so it keeps its own number.
  revalidationDueInDays: 18,
  shift: {
    gpsOnline: FLOOR.gpsOnline, gpsNeeded: FLOOR.gpsNeeded, patientsWaiting: FLOOR.waiting,
    minutesOnline: 42,
    earningsToday: TODAY_ROW.earnings,   // today's row in DAILY_CONSULTS, never retyped
  },
} as const;

export const GATE_RECORDS: Record<GateId, CredentialRecord> = {
  'verification-pending': GPS.find((gp) => gp.ref === 'GP-004')!.credentials,
  'verification-rejected': {
    ...GPS.find((gp) => gp.ref === 'GP-004')!.credentials,
    dbs: { status: 'rejected', daysRemaining: null },
  },
  'indemnity-expired': GPS.find((gp) => gp.ref === 'GP-003')!.credentials,
  'revalidation-due': { ...MY_RECORD, revalidation: { status: 'expiring', daysRemaining: DOCTOR.revalidationDueInDays } },
};

export const SKILLS: Skill[] = [
  { id: 'general-adult', label: 'General adult medicine', defaultOn: true },
  { id: 'minor-illness', label: 'Minor illness', defaultOn: true },
  { id: 'womens-health', label: "Women's health", defaultOn: false },
  { id: 'mental-health', label: 'Mental health', defaultOn: false },
  { id: 'paediatrics', label: 'Paediatrics (age 5+)', defaultOn: false },
  { id: 'dermatology', label: 'Dermatology', defaultOn: false },
];

export const PATIENT_ACCOUNT = {
  ref: 'PT-0148',
  initials: 'PT',
  memberSince: 'March 2026',
  identityVerified: true,
  nhsPractice: 'Example Medical Centre, London',
  nhsPostcode: 'N1 9AA',
  pharmacy: 'Example Pharmacy, London N1',
  nhsShareConsent: true,
  cardBrand: 'Visa',
  cardLast4: '4242',
  email: 'patient@example.com',
};

// Reasons are the patient's own words on the triage screen, never a diagnosis
// and never a medicine — this surface must not read as a clinical record.
export const CONSULTATIONS: ConsultationRow[] = [
  {
    id: 'C-0031', date: '12 August 2026', at: '2026-08-12', gp: 'GP-002',
    reason: 'Sore throat and fever', minutes: 9, status: 'completed', cost: 46,
    outcome: { prescription: true, referral: false, fitNote: false, sharedWithNhsGp: true },
  },
  {
    id: 'C-0022', date: '2 July 2026', at: '2026-07-02', gp: 'GP-001',
    reason: 'Rash on forearm', minutes: 7, status: 'completed', cost: 39,
    outcome: { prescription: false, referral: true, fitNote: false, sharedWithNhsGp: true },
  },
  {
    id: 'C-0014', date: '19 May 2026', at: '2026-05-19', gp: 'GP-003',
    reason: 'Cough lasting two weeks', minutes: 11, status: 'completed', cost: 52,
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
export const PRESCRIPTIONS: PrescriptionRow[] = [
  {
    id: 'RX-0031', consultation: 'C-0031', issued: '12 August 2026',
    pharmacy: PATIENT_ACCOUNT.pharmacy,
    steps: [
      { label: 'Written by your GP', when: '12 August, 14:20', done: true },
      { label: 'Sent to your pharmacy', when: '12 August, 14:22', done: true },
      { label: 'Ready to collect', when: 'Waiting on the pharmacy', done: false, now: true },
      { label: 'Collected', when: null, done: false },
    ],
  },
  {
    id: 'RX-0014', consultation: 'C-0014', issued: '19 May 2026',
    pharmacy: PATIENT_ACCOUNT.pharmacy,
    steps: [
      { label: 'Written by your GP', when: '19 May, 09:40', done: true },
      { label: 'Sent to your pharmacy', when: '19 May, 09:41', done: true },
      { label: 'Ready to collect', when: '19 May, 16:05', done: true },
      { label: 'Collected', when: '20 May, 11:12', done: true },
    ],
  },
];

/* Doctor dashboard. Consults and earnings are two separate facts now: a busy
   evening pays more per consultation than a quiet morning, so the chart counts
   consultations and the money is summed from the amounts each one actually
   paid. The recent rows sum to their day in DAILY_CONSULTS. */

export const DOCTOR_DASHBOARD = {
  initials: 'GP',
  acceptanceRate: 0.86,
  averageConsultMinutes: 9,
  dailyConsults: DAILY_CONSULTS,
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
  ] as DemandHour[],
  // A GP does not book shifts here. They go online, take offers as they come,
  // and go offline. Today's offers, and what happened to them:
  offersToday: { offered: 4, accepted: 3, declined: 1 },
  // Today's three sum to DAILY_CONSULTS['28'] and yesterday's two to ['27'].
  recent: [
    { id: 'C-0031', when: 'Today, 14:20', ageBand: '30–39', minutes: 9, outcome: 'Prescription issued', fee: 34 },
    { id: 'C-0030', when: 'Today, 13:05', ageBand: '18–29', minutes: 7, outcome: 'Advice only', fee: 31 },
    { id: 'C-0029', when: 'Today, 11:40', ageBand: '40–49', minutes: 12, outcome: 'Referred to NHS GP', fee: 37 },
    { id: 'C-0028', when: 'Yesterday, 20:15', ageBand: '5–17', minutes: 8, outcome: 'Advice only', fee: 33 },
    { id: 'C-0027', when: 'Yesterday, 19:02', ageBand: '60+', minutes: 14, outcome: 'Escalated to 111', fee: 24 },
  ] as RecentConsult[],
  payout: { period: '22 – 28 August', date: 'Friday 4 September', method: 'Bank transfer' },
};

export const DEMAND_BY_HOUR = DOCTOR_DASHBOARD.demandByHour;

export const AUDIT_LOG = [
  { when: '28 August, 09:02', actor: 'System', action: 'Indemnity cover for GP-003 marked expired' },
  { when: '27 August, 16:40', actor: 'Admin', action: 'Restricted items register reviewed' },
  { when: '26 August, 21:14', actor: 'Admin', action: 'Break-glass access to C-0031' },
] as const;

// One run, due on the payout date, paying every consultation PRESCRIBING attributes
// to a GP — so its GP count is the three prescribers, not the two online now.
export const PAYOUT_RUNS = [{
  period: DOCTOR_DASHBOARD.payout.period, date: DOCTOR_DASHBOARD.payout.date,
  gps: PRESCRIBING.filter((gp) => gp.consults > 0).length, consults: BUSINESS.consults,
  amount: BUSINESS.revenue, status: 'Due',
}] as const;

export function applicationsInVerification(gps: readonly Gp[] = GPS): Application[] {
  return gps.flatMap((gp) => {
    const pending = (Object.keys(gp.credentials) as CredentialKey[]).find((k) => gp.credentials[k].status === 'pending');
    return pending ? [{ ref: gp.ref, stage: CREDENTIAL_LABELS[pending] }] : [];
  });
}

// Re-exported so a caller of the fixture surface never needs a second import
// just to render the same placeholder dash the rest of the dashboard uses.
export { DASH } from '@/lib/placeholder';
