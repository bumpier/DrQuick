'use client';

import type { ComponentType } from 'react';
import type { BookingScreen } from '@/lib/booking-flow';
import { useBooking } from './BookingProvider';
import { Call } from './steps/Call';
import { Done } from './steps/Done';
import { Finding } from './steps/Finding';
import { Identity } from './steps/Identity';
import { NhsGp } from './steps/NhsGp';
import { Outcome } from './steps/Outcome';
import { Quote } from './steps/Quote';
import { Ready } from './steps/Ready';
import { SafetyCheck } from './steps/SafetyCheck';
import { Symptoms } from './steps/Symptoms';
import { Cancelled } from './states/Cancelled';
import { ConsentRefused } from './states/ConsentRefused';
import { EndedEarly } from './states/EndedEarly';
import { NoGpAvailable } from './states/NoGpAvailable';
import { PaymentFailed } from './states/PaymentFailed';
import { RedFlag } from './states/RedFlag';

const SCREENS: Record<BookingScreen, ComponentType> = {
  symptoms: Symptoms,
  'safety-check': SafetyCheck,
  identity: Identity,
  'nhs-gp': NhsGp,
  quote: Quote,
  finding: Finding,
  ready: Ready,
  call: Call,
  outcome: Outcome,
  done: Done,
  'red-flag': RedFlag,
  'consent-refused': ConsentRefused,
  'no-gp-available': NoGpAvailable,
  cancelled: Cancelled,
  'payment-failed': PaymentFailed,
  'ended-early': EndedEarly,
};

// The route renders whatever the booking is on, never what the URL said:
// the URL follows the reducer. Keyed by screen so each one mounts fresh and
// takes focus on arrival.
export function BookingFlow() {
  const { state } = useBooking();
  const Screen = SCREENS[state.screen];
  return <Screen key={state.screen} />;
}
