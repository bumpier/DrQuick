// How it works copy. The patient journey is the booking flow in
// components/patient/steps, in order, told plainly; the GP half reuses the
// landing page's steps and does / doesn't lists, so the two never disagree.
import type { StepTile } from '@/components/site/PageParts';

export const PATIENT_JOURNEY: StepTile[] = [
  { title: 'Tell us what’s wrong.', body: 'A two-minute form in plain English, so the GP already knows why you’re calling.' },
  { title: 'A quick safety check.', body: 'A few questions make sure video is right for you. If anything points to an emergency, we tell you to call 999 and nothing is charged.' },
  { title: 'Confirm it’s you.', body: 'A photo ID check, with a passport or driving licence. It takes about a minute.' },
  { title: 'Your NHS GP.', body: 'Tell us your practice and, with your consent, we send them a summary afterwards.' },
  { title: 'See your price, in full.', body: 'Before you commit. It is held on your card, not taken, and never changed after.' },
  { title: 'Get matched.', body: 'You’re handed to the next GP who is free, instead of picking a time slot.' },
  { title: 'Talk by video.', body: 'A secure video consultation with a GMC-registered GP. The call is not recorded.' },
  { title: 'Afterwards.', body: 'A prescription sent to a pharmacy you choose, a fit note or a referral, if the GP judges you need one. Your summary is saved to your account.' },
];

export const GP_CHECKS = [
  'GMC registration and a licence to practise',
  'A place on the GP Register',
  'An enhanced DBS check',
  'Right to work in the UK',
  'Your own medical indemnity for private work',
];
