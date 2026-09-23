/* What a patient's account holds, derived rather than stored. The history,
   the prescriptions and the to-do list are all computed from two inputs — the
   fixtures (when seeded) and what this session actually produced — so no
   screen can show a consultation, a prescription or a reminder that the
   other screens do not also know about. Pure; the React provider in
   components/patient/PatientProvider.tsx holds the session arrays and calls
   these. */
import { CONSULTATIONS, PRESCRIPTIONS } from '@/lib/fixtures';
import type { ConsultationRow } from '@/lib/booking';

export type { ConsultationRow, ConsultationOutcome } from '@/lib/booking';

export type PrescriptionStep = { label: string; when: string | null; done: boolean; now?: boolean };
export type PrescriptionRow = {
  id: string;
  consultation: string;
  issued: string;
  pharmacy: string | null;
  steps: PrescriptionStep[];
};

/* The one sentence every screen reached by URL shows when this session has
   not produced the thing it would otherwise describe. Never an invented
   consultation. */
export const NOTHING_YET = 'Nothing here yet. Start a consultation and this screen fills with what actually happened.';

/* --- consultations ---------------------------------------------------- */

/* This session's records first, newest first, then the fixtures when seeded.
   Blank mode is the first patient: nothing but what they just did. */
export function historyFor({ seeded, session }: { seeded: boolean; session: readonly ConsultationRow[] }): ConsultationRow[] {
  return [...session, ...(seeded ? CONSULTATIONS : [])];
}

/* Prepend a record. Only the newest one is new; a record already on the list
   is not written twice (a StrictMode double effect, a repeated Continue), and
   in that case the same array comes back so a state setter can no-op. */
export function addToHistory(session: ConsultationRow[], record: ConsultationRow): ConsultationRow[] {
  if (session.some((row) => row.id === record.id)) return session;
  return [{ ...record, isNew: true }, ...session.map(({ isNew: _isNew, ...row }) => row)];
}

/* --- prescriptions ----------------------------------------------------- */

/* A consultation that ended in a prescription leaves a prescription behind,
   derived from the record itself so the outcome screen, the prescriptions
   page and the home reminder cannot disagree. With a pharmacy on file it is
   written and sent, and the pharmacy is the next step; with none saved it is
   written and waiting to be sent — the flow does not nominate a pharmacy
   yet, and the timeline says so rather than inventing one. */
export function prescriptionFor(record: ConsultationRow, pharmacy: string | null): PrescriptionRow | null {
  if (record.status !== 'completed' || !record.outcome?.prescription) return null;
  const steps: PrescriptionStep[] = pharmacy
    ? [
        { label: 'Written by your GP', when: 'Just now', done: true },
        { label: 'Sent to your pharmacy', when: 'Just now', done: true },
        { label: 'Ready to collect', when: 'Waiting on the pharmacy', done: false, now: true },
        { label: 'Collected', when: null, done: false },
      ]
    : [
        { label: 'Written by your GP', when: 'Just now', done: true },
        { label: 'Sent to your pharmacy', when: 'No pharmacy saved yet', done: false, now: true },
        { label: 'Ready to collect', when: null, done: false },
        { label: 'Collected', when: null, done: false },
      ];
  return {
    id: `RX-${record.id.replace(/\D/g, '')}`,
    consultation: record.id,
    issued: record.date,
    pharmacy,
    steps,
  };
}

export function prescriptionsFor({ seeded, session }: { seeded: boolean; session: readonly PrescriptionRow[] }): PrescriptionRow[] {
  return [...session, ...(seeded ? PRESCRIPTIONS : [])];
}

export function addPrescription(session: PrescriptionRow[], rx: PrescriptionRow): PrescriptionRow[] {
  if (session.some((row) => row.id === rx.id)) return session;
  return [rx, ...session];
}

/* The step a prescription is on, for the card title and the home reminder. */
export function currentStep(rx: PrescriptionRow): PrescriptionStep | null {
  return rx.steps.find((step) => step.now) ?? null;
}

export function isCollected(rx: PrescriptionRow): boolean {
  return rx.steps.every((step) => step.done);
}

/* --- what needs the patient ------------------------------------------- */

export type Todo = {
  id: 'prescription' | 'unshared' | 'practice';
  tone: 'act' | 'watch';
  title: string;
  note: string;
  action: { label: string; href: string };
};

/* Derived from the same records the rest of the account shows, so the list
   can never tell the patient about something that is not really there. */
export function todosFor({ history, prescriptions, practice }: {
  history: readonly ConsultationRow[];
  prescriptions: readonly PrescriptionRow[];
  practice: string | null;
}): Todo[] {
  const open = prescriptions.find((rx) => rx.steps.some((step) => step.now));
  const unshared = history.some((row) => row.status === 'completed' && row.outcome !== null && !row.outcome.sharedWithNhsGp);
  const todos: Todo[] = [];
  if (open) {
    todos.push(open.pharmacy
      ? {
          id: 'prescription', tone: 'act',
          title: 'A prescription is waiting at your pharmacy',
          note: `${open.pharmacy}. Take photo ID with you. The pharmacy charges for the medicine.`,
          action: { label: 'Track', href: '/patient/prescriptions' },
        }
      : {
          id: 'prescription', tone: 'act',
          title: 'A prescription is waiting to be sent',
          note: 'No pharmacy is saved yet. The pharmacy charges for the medicine.',
          action: { label: 'Track', href: '/patient/prescriptions' },
        });
  }
  if (unshared) {
    todos.push({
      id: 'unshared', tone: 'watch',
      title: 'One consultation was never sent to your NHS GP',
      note: 'You chose not to share it at the time. You can still send it.',
      action: { label: 'Review', href: '/patient/consultations' },
    });
  }
  if (practice) {
    todos.push({
      id: 'practice', tone: 'watch',
      title: 'Confirm your NHS GP practice',
      note: 'We send your consultation summary here. Check it is still right.',
      action: { label: 'Check', href: '/patient/account' },
    });
  }
  return todos;
}

/* --- routes ------------------------------------------------------------- */

const DETAIL_ROOT = '/patient/consultations/';

/* The id a detail URL names, or null for the list and anything malformed.
   The raw value is only ever compared with the ids on file, never echoed. */
export function consultationIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(DETAIL_ROOT)) return null;
  const tail = pathname.slice(DETAIL_ROOT.length).replace(/\/+$/g, '');
  return tail === '' || tail.includes('/') ? null : tail;
}
