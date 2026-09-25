// About page copy. Every figure is sourced research recorded in PRODUCT.md and
// Docs/Dr_Quick_Research_Report.md, and names its source on the page. Nothing
// here claims a customer, a GP headcount, a team or a result: the service has
// not launched (PRODUCT.md, "Absences future work must not fabricate").
import type { Tone } from '@/components/site/PageParts';

export const GAP = {
  figures: [
    { figure: '52%', claim: 'of people who go private do it to be seen quicker.', source: 'YouGov', tone: 'wash' as Tone },
    { figure: '15%', claim: 'of GPs surveyed can find no GP work at all.', source: 'BMA survey of more than 1,000 GPs', tone: 'band' as Tone },
    { figure: '56%', claim: 'of GPs surveyed want more NHS hours but cannot find them.', source: 'BMA survey of more than 1,000 GPs', tone: 'stone' as Tone },
  ],
  quote: {
    text: 'A ludicrous situation where patients can’t get a GP, yet qualified GPs couldn’t get a job.',
    source: 'Department of Health and Social Care',
  },
};

export const PROMISES = [
  { title: 'Your price in full, before you book.', body: 'You see the whole price before you commit. It is held on your card, taken only when a GP accepts, and never changed after.' },
  { title: 'Real, checked GPs.', body: 'Every GP holds GMC registration, a licence to practise and a place on the GP Register, checked before they see anyone.' },
  { title: 'England, at launch.', body: 'Scotland, Wales and Northern Ireland are regulated separately, so they are not covered at launch.' },
  { title: 'A CQC-registered clinical service at launch.', body: 'Nobody is seen before that registration is in place.' },
  { title: 'Your NHS GP kept in the loop.', body: 'With your consent, we send them a summary of every consultation.' },
];

export const WONT = [
  'Charge a membership or a subscription.',
  'Change your price after you book.',
  'Let anyone pay to be seen ahead of someone more urgent.',
  'Replace your NHS GP.',
  'Share or sell your details.',
  'Pretend to be for emergencies. Call 999 or go to A&E.',
];
