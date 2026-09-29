// The landing page's sections in reading order, per mode. Each name is the
// `data-section` attribute on that section's root element (app/page.tsx), and
// the tracker records a `section_view` with its dwell time when one is read.
// The dashboards walk these lists to draw read-through funnels, so the names
// are stable: rename one and its history splits in two.
export const PATIENT_SECTIONS = [
  'patient-hero',
  'patient-urgent',
  'patient-how-it-works',
  'patient-covers',
  'patient-price',
  'patient-faq',
  'patient-closing',
] as const;

export const GP_SECTIONS = [
  'gp-hero',
  'gp-shift',
  'gp-scope',
  'gp-pay',
  'gp-faq',
  'gp-closing',
] as const;

export type SectionName = (typeof PATIENT_SECTIONS)[number] | (typeof GP_SECTIONS)[number];

export const SECTIONS = { patient: PATIENT_SECTIONS, gp: GP_SECTIONS } as const;
