/* Registration through to "you're ready", as data. Each step's gate carries
   its own status because they clear at very different speeds; the reducer
   only moves forward on the action that step offers, and landing on a later
   step by URL seeds everything before it as done so no screen is ever blank. */
import { SKILLS, type SkillId, type Credential } from '@/lib/fixtures';

export const ONBOARDING_STEPS = ['register', 'identity', 'credentials', 'indemnity', 'skills', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const GMC_PATTERN = /^\d{7}$/;

// preview/doctor.html:294-298 — four checks pending, right to work already verified.
export const ONBOARDING_RECORD = {
  gmc: { status: 'pending', daysRemaining: null },
  licence: { status: 'pending', daysRemaining: null },
  cct: { status: 'pending', daysRemaining: null },
  dbs: { status: 'pending', daysRemaining: null },
  rightToWork: { status: 'valid', daysRemaining: null },
} as const satisfies Record<'gmc' | 'licence' | 'cct' | 'dbs' | 'rightToWork', Credential>;

export type OnboardingState = {
  step: OnboardingStep;
  reached: number;
  nav: number;                     // bumped by every step-advancing action; the URL follows this, never by jump
  email: string;
  gmc: string;
  gmcError: string | null;
  identityVerified: boolean;
  indemnity: { cover: 'block' | 'own' | null; expiry: string; fileName: string; error: string | null };
  skills: SkillId[];
};

export type OnboardingAction =
  | { type: 'jump'; step: OnboardingStep }
  | { type: 'setEmail'; value: string }
  | { type: 'setGmc'; value: string }
  | { type: 'submitRegister' }
  | { type: 'verifyIdentity' }
  | { type: 'continueCredentials' }
  | { type: 'useBlockCover' }
  | { type: 'setIndemnityExpiry'; value: string }
  | { type: 'setIndemnityFile'; name: string }
  | { type: 'uploadCertificate' }
  | { type: 'toggleSkill'; id: SkillId }
  | { type: 'finishSkills' };

export const GMC_ERROR = 'Enter your 7-digit GMC number.';
export const INDEMNITY_ERROR = 'Enter the expiry date on your certificate.';

const index = (step: OnboardingStep) => ONBOARDING_STEPS.indexOf(step);

function advance(state: OnboardingState, to: OnboardingStep): OnboardingState {
  return { ...state, step: to, reached: Math.max(state.reached, index(to)), nav: state.nav + 1 };
}

export function initialOnboarding(step: OnboardingStep | null): OnboardingState {
  const base: OnboardingState = {
    step: 'register', reached: 0, nav: 0,
    email: 'dr.locum@example.com', gmc: '4567890', gmcError: null,
    identityVerified: false,
    indemnity: { cover: null, expiry: '', fileName: '', error: null },
    skills: SKILLS.filter((s) => s.defaultOn).map((s) => s.id),
  };
  return step && step !== 'register' ? onboardingReducer(base, { type: 'jump', step }) : base;
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'jump': {
      const i = index(action.step);
      return {
        ...state, step: action.step, reached: Math.max(state.reached, i),
        identityVerified: state.identityVerified || i >= index('credentials'),
        indemnity: i >= index('skills') && state.indemnity.cover === null ? { ...state.indemnity, cover: 'block' } : state.indemnity,
      };
    }
    case 'setEmail':
      return { ...state, email: action.value };
    case 'setGmc':
      return { ...state, gmc: action.value, gmcError: GMC_PATTERN.test(action.value.trim()) ? null : state.gmcError };
    case 'submitRegister':
      if (state.step !== 'register') return state;
      if (!GMC_PATTERN.test(state.gmc.trim())) return { ...state, gmcError: GMC_ERROR };
      return advance({ ...state, gmcError: null }, 'identity');
    case 'verifyIdentity':
      return state.step === 'identity' ? advance({ ...state, identityVerified: true }, 'credentials') : state;
    case 'continueCredentials':
      return state.step === 'credentials' ? advance(state, 'indemnity') : state;
    case 'useBlockCover':
      return state.step === 'indemnity' ? advance({ ...state, indemnity: { ...state.indemnity, cover: 'block', error: null } }, 'skills') : state;
    case 'setIndemnityExpiry':
      return { ...state, indemnity: { ...state.indemnity, expiry: action.value, error: action.value ? null : state.indemnity.error } };
    case 'setIndemnityFile':
      return { ...state, indemnity: { ...state.indemnity, fileName: action.name } };
    case 'uploadCertificate':
      if (state.step !== 'indemnity') return state;
      if (!state.indemnity.expiry) return { ...state, indemnity: { ...state.indemnity, error: INDEMNITY_ERROR } };
      return advance({ ...state, indemnity: { ...state.indemnity, cover: 'own', error: null } }, 'skills');
    case 'toggleSkill':
      return {
        ...state,
        skills: state.skills.includes(action.id) ? state.skills.filter((id) => id !== action.id) : [...state.skills, action.id],
      };
    case 'finishSkills':
      return state.step === 'skills' ? advance(state, 'done') : state;
    default:
      return state;
  }
}

export function stepStatus(state: OnboardingState, step: OnboardingStep): 'done' | 'current' | 'todo' {
  if (step === state.step) return 'current';
  return index(step) < index(state.step) || index(step) < state.reached ? 'done' : 'todo';
}

const ROOT = '/doctor/onboarding';
/* The bare path has no opinion (see sessionScreenFromPath): it must never rewind `reached`. */
export function onboardingStepFromPath(pathname: string): OnboardingStep | null {
  if (!pathname.startsWith(`${ROOT}/`)) return null;
  const tail = pathname.slice(ROOT.length + 1).replace(/\/+$/g, '');
  return (ONBOARDING_STEPS as readonly string[]).includes(tail) ? (tail as OnboardingStep) : null;
}
export function onboardingHref(step: OnboardingStep): string { return `${ROOT}/${step}`; }
