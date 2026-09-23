'use client';

/* What the patient's account holds for this session: the consultations and
   prescriptions it has produced, whether the ID check ran, the practice they
   gave and their standing choice about sharing summaries. Everything shown is
   derived from these and the fixtures (seeded mode only) by lib/patient.ts,
   so no screen can show a record another screen does not also know about.
   Memory only: nothing is written to storage, a cookie or the URL, because a
   consultation is health data. */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDataMode } from '@/lib/data-mode';
import { nextConsultationId } from '@/lib/booking';
import type { SavedPractice } from '@/lib/booking-flow';
import { PATIENT_ACCOUNT } from '@/lib/fixtures';
import {
  addPrescription, addToHistory, historyFor, prescriptionFor, prescriptionsFor, todosFor,
  type ConsultationRow, type PrescriptionRow, type Todo,
} from '@/lib/patient';

type PatientContextValue = {
  account: typeof PATIENT_ACCOUNT;
  history: ConsultationRow[];
  prescriptions: PrescriptionRow[];
  todos: Todo[];
  nextId: string;
  identityVerified: boolean;       // on file for a returning patient, or checked in this session
  identityChecked: boolean;        // checked in this session
  card: { brand: string; last4: string } | null;
  saved: SavedPractice | null;     // the practice on file: this session's answer, else a returning patient's
  pharmacy: string | null;
  consent: boolean;                // the standing preference on the account page; never pre-answers a booking
  setConsent: (on: boolean) => void;
  addRecord: (record: ConsultationRow) => void;
  markIdentityChecked: () => void;
  rememberPractice: (saved: SavedPractice) => void;
};

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const { seeded } = useDataMode();
  const [session, setSession] = useState<ConsultationRow[]>([]);
  const [sessionRx, setSessionRx] = useState<PrescriptionRow[]>([]);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [consentPref, setConsentPref] = useState<boolean | null>(null);
  const [remembered, setRemembered] = useState<SavedPractice | null>(null);

  const pharmacy = seeded ? PATIENT_ACCOUNT.pharmacy : null;
  const saved = useMemo<SavedPractice | null>(
    () => remembered ?? (seeded ? { practice: PATIENT_ACCOUNT.nhsPractice, postcode: PATIENT_ACCOUNT.nhsPostcode } : null),
    [remembered, seeded],
  );
  const history = useMemo(() => historyFor({ seeded, session }), [seeded, session]);
  const prescriptions = useMemo(() => prescriptionsFor({ seeded, session: sessionRx }), [seeded, sessionRx]);
  const todos = useMemo(
    () => todosFor({ history, prescriptions, practice: saved?.practice ?? null }),
    [history, prescriptions, saved],
  );

  // A consultation that ended in a prescription leaves the prescription
  // behind, derived from the same record the history shows.
  const addRecord = useCallback((record: ConsultationRow) => {
    setSession((current) => addToHistory(current, record));
    const rx = prescriptionFor(record, pharmacy);
    if (rx) setSessionRx((current) => addPrescription(current, rx));
  }, [pharmacy]);

  const markIdentityChecked = useCallback(() => setIdentityChecked(true), []);
  const rememberPractice = useCallback((next: SavedPractice) => {
    setRemembered((current) =>
      current && current.practice === next.practice && current.postcode === next.postcode ? current : next);
  }, []);
  const setConsent = useCallback((on: boolean) => setConsentPref(on), []);

  const value = useMemo<PatientContextValue>(() => ({
    account: PATIENT_ACCOUNT,
    history,
    prescriptions,
    todos,
    nextId: nextConsultationId(history),
    identityVerified: (seeded && PATIENT_ACCOUNT.identityVerified) || identityChecked,
    identityChecked,
    card: seeded ? { brand: PATIENT_ACCOUNT.cardBrand, last4: PATIENT_ACCOUNT.cardLast4 } : null,
    saved,
    pharmacy,
    consent: consentPref ?? PATIENT_ACCOUNT.nhsShareConsent,
    setConsent,
    addRecord,
    markIdentityChecked,
    rememberPractice,
  }), [
    history, prescriptions, todos, seeded, identityChecked, saved, pharmacy, consentPref,
    setConsent, addRecord, markIdentityChecked, rememberPractice,
  ]);

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient(): PatientContextValue {
  const context = useContext(PatientContext);
  if (!context) throw new Error('usePatient outside PatientProvider');
  return context;
}
