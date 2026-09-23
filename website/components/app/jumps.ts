/* The prototype rail, as data. preview/js/doctor.js:41-73 and admin.html:210-217
   listed every screen and state by id; here each is the URL it lives at, and a
   gate is the record the dashboard renders from (Decision 1). The jumper is a
   development tool: every jump is a full page load. */
export type JumpKind = 'screen' | 'state';
export type Jump = { href: string; label: string; kind: JumpKind };
export type JumpGroup = { label: string; items: Jump[] };
export type JumpLocation = { pathname: string; search: string };

const session = (state: string) => `/doctor/session/${state}`;
const step = (id: string) => `/doctor/onboarding/${id}`;
const gate = (id: string) => `/doctor?gate=${id}`;

// A query-only href keeps the current path; an empty value strips the key.
export const DATA_JUMPS: JumpGroup = {
  label: 'Data',
  items: [
    { href: '?data=', label: 'Blank', kind: 'screen' },
    { href: '?data=seeded', label: 'Seeded', kind: 'screen' },
  ],
};

export const DOCTOR_JUMPS: JumpGroup[] = [
  { label: 'Dashboard', items: [
    { href: '/doctor', label: 'Dashboard', kind: 'screen' },
    { href: '/doctor/earnings', label: 'Earnings', kind: 'screen' },
    { href: '/doctor/profile', label: 'Profile', kind: 'screen' },
  ] },
  { label: 'Onboarding', items: [
    { href: step('register'), label: 'Register', kind: 'screen' },
    { href: step('identity'), label: 'Identity', kind: 'screen' },
    { href: step('credentials'), label: 'Credentials', kind: 'screen' },
    { href: step('indemnity'), label: 'Indemnity', kind: 'screen' },
    { href: step('skills'), label: 'Skills', kind: 'screen' },
    { href: step('done'), label: 'Done', kind: 'screen' },
  ] },
  { label: 'Shift', items: [
    { href: session('offline'), label: 'Offline', kind: 'screen' },
    { href: session('online-idle'), label: 'Online', kind: 'screen' },
    { href: session('offer'), label: 'Offer', kind: 'screen' },
    { href: session('consultation'), label: 'Consult', kind: 'screen' },
    { href: session('complete'), label: 'Complete', kind: 'screen' },
  ] },
  { label: 'States', items: [
    { href: gate('verification-pending'), label: 'Pending', kind: 'state' },
    { href: gate('verification-rejected'), label: 'Rejected', kind: 'state' },
    { href: gate('indemnity-expired'), label: 'Indemnity expired', kind: 'state' },
    { href: session('offer-consent-refused'), label: 'Offer — consent refused', kind: 'state' },
    { href: session('offer-declined'), label: 'Declined', kind: 'state' },
    { href: session('offer-timed-out'), label: 'Timed out', kind: 'state' },
    { href: session('patient-no-show'), label: 'No-show', kind: 'state' },
    { href: gate('revalidation-due'), label: 'Revalidation', kind: 'state' },
    { href: session('no-patients-waiting'), label: 'Nobody waiting', kind: 'state' },
  ] },
  DATA_JUMPS,
];

export const ADMIN_JUMPS: JumpGroup[] = [
  { label: 'Sections', items: [
    { href: '/admin', label: 'Live floor', kind: 'screen' },
    { href: '/admin/governance', label: 'Governance', kind: 'screen' },
    { href: '/admin/supply', label: 'GP supply', kind: 'screen' },
    { href: '/admin/business', label: 'Business', kind: 'screen' },
  ] },
  DATA_JUMPS,
];

const split = (href: string): [path: string, query: string] => {
  const i = href.indexOf('?');
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i + 1)];
};

/* The href a jump really loads: the current query is carried (Decision 2 — a
   copied link keeps its mode and gate), the jump's own keys win, an empty value strips. */
export function jumpHref(href: string, loc: JumpLocation): string {
  const [path, query] = split(href);
  const params = new URLSearchParams(loc.search);
  for (const [key, value] of new URLSearchParams(query)) {
    if (value === '') params.delete(key); else params.set(key, value);
  }
  const qs = params.toString();
  return `${path || loc.pathname}${qs ? `?${qs}` : ''}`;
}

// `gate` chooses what /doctor shows, so the Dashboard jump is not current under a gate.
const SCREEN_KEYS = ['gate'];

export function isCurrentJump(href: string, loc: JumpLocation): boolean {
  const [path, query] = split(href);
  if (path && path !== loc.pathname) return false;
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(loc.search);
  for (const [key, value] of want) if ((have.get(key) ?? '') !== value) return false;
  return !path || SCREEN_KEYS.every((key) => want.has(key) === have.has(key));
}
