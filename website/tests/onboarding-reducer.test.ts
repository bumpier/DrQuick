import { test, expect } from 'vitest';
import {
  ONBOARDING_STEPS, initialOnboarding, onboardingReducer, onboardingStepFromPath, onboardingHref, stepStatus, GMC_PATTERN,
} from '@/lib/onboarding';

test('starts on register with the worked example filled in and the default skills on', () => {
  const s = initialOnboarding(null);
  expect(s).toMatchObject({ step: 'register', reached: 0, nav: 0, email: 'dr.locum@example.com', gmc: '4567890', identityVerified: false });
  expect(s.skills).toEqual(['general-adult', 'minor-illness']);
});

test('landing on a later step seeds every earlier step as complete', () => {
  const s = initialOnboarding('indemnity');
  expect(s.step).toBe('indemnity');
  expect(s.reached).toBe(3);
  expect(s.identityVerified).toBe(true);
  expect(ONBOARDING_STEPS.slice(0, 3).map((step) => stepStatus(s, step))).toEqual(['done', 'done', 'done']);
  expect(stepStatus(s, 'indemnity')).toBe('current');
  expect(stepStatus(s, 'skills')).toBe('todo');
});

test('register validates the GMC number as seven digits and only then continues', () => {
  let s = onboardingReducer(initialOnboarding(null), { type: 'setGmc', value: '12' });
  s = onboardingReducer(s, { type: 'submitRegister' });
  expect(s).toMatchObject({ step: 'register', gmcError: 'Enter your 7-digit GMC number.' });
  s = onboardingReducer(s, { type: 'setGmc', value: '1234567' });
  expect(s.gmcError).toBeNull();
  s = onboardingReducer(s, { type: 'submitRegister' });
  expect(s).toMatchObject({ step: 'identity', reached: 1 });
  expect(GMC_PATTERN.test('1234567')).toBe(true);
});

test('the happy path walks every step in order', () => {
  let s = initialOnboarding(null);
  s = onboardingReducer(s, { type: 'submitRegister' });
  s = onboardingReducer(s, { type: 'verifyIdentity' });
  expect(s).toMatchObject({ step: 'credentials', identityVerified: true });
  s = onboardingReducer(s, { type: 'continueCredentials' });
  expect(s.step).toBe('indemnity');
  s = onboardingReducer(s, { type: 'useBlockCover' });
  expect(s).toMatchObject({ step: 'skills', indemnity: { cover: 'block' } });
  s = onboardingReducer(s, { type: 'toggleSkill', id: 'dermatology' });
  expect(s.skills).toContain('dermatology');
  s = onboardingReducer(s, { type: 'toggleSkill', id: 'minor-illness' });
  expect(s.skills).not.toContain('minor-illness');
  s = onboardingReducer(s, { type: 'finishSkills' });
  expect(s).toMatchObject({ step: 'done', reached: 5 });
});

test('the own-certificate path needs an expiry date and is equally real', () => {
  let s = initialOnboarding('indemnity');
  s = onboardingReducer(s, { type: 'uploadCertificate' });
  expect(s).toMatchObject({ step: 'indemnity', indemnity: { error: 'Enter the expiry date on your certificate.' } });
  s = onboardingReducer(s, { type: 'setIndemnityFile', name: 'cover.pdf' });
  s = onboardingReducer(s, { type: 'setIndemnityExpiry', value: '2027-08-31' });
  s = onboardingReducer(s, { type: 'uploadCertificate' });
  expect(s).toMatchObject({ step: 'skills', indemnity: { cover: 'own', expiry: '2027-08-31', fileName: 'cover.pdf', error: null } });
});

test('a step action fired from the wrong step is ignored', () => {
  const s = initialOnboarding('skills');
  expect(onboardingReducer(s, { type: 'verifyIdentity' })).toBe(s);
  expect(onboardingReducer(s, { type: 'useBlockCover' })).toBe(s);
});

test('paths — the bare path has no opinion and the preview id does not survive as a URL', () => {
  expect(onboardingStepFromPath('/doctor/onboarding')).toBeNull();
  expect(onboardingStepFromPath('/doctor/onboarding/skills')).toBe('skills');
  expect(onboardingStepFromPath('/doctor/onboarding/onboarding-done')).toBeNull();
  expect(onboardingStepFromPath('/doctor/onboarding/nope')).toBeNull();
  expect(onboardingHref('done')).toBe('/doctor/onboarding/done');
});

test('nav counts forward moves only', () => {
  let s = initialOnboarding(null);
  expect(s.nav).toBe(0);
  s = onboardingReducer(s, { type: 'submitRegister' });
  expect(s.nav).toBe(1);
  s = onboardingReducer(s, { type: 'jump', step: 'skills' });
  expect(s.nav).toBe(1);
  s = onboardingReducer(s, { type: 'toggleSkill', id: 'dermatology' });
  expect(s.nav).toBe(1);
});
