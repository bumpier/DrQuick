// @vitest-environment jsdom
import { test, expect, vi, beforeEach, describe } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));
import { renderBooking, renderPatient, nav } from './helpers/render-patient';
import { BookingFlow } from '@/components/patient/BookingFlow';
import { usePatient } from '@/components/patient/PatientProvider';
import { matchGp, type ConsultationRow } from '@/lib/booking';
import {
  AUTHORISE_MS, BOOKING_SCREENS, COMPLAINT_ERROR, DETAILS_ERROR, DURATION_ERROR, IDENTITY_CHECK_MS,
  POSTCODE_ERROR, PRACTICE_ERROR, type BookingScreen,
} from '@/lib/booking-flow';
import { GPS, PATIENT_ACCOUNT, PRESCRIBING, PRICE } from '@/lib/fixtures';
import { NOTHING_YET } from '@/lib/patient';

/* Every booking screen, in both data modes, and every fork a patient can meet.
   Blank is the first patient (nothing invented for them); seeded is the
   returning patient's worked example. The copy asserted verbatim is the copy
   that carries a promise: the price, the hold, 999, 111, "not recorded". */

const T0 = Date.parse('2026-08-28T14:00:00Z');
const SEEDED = 'data=seeded';
type Mode = 'blank' | 'seeded';
const MODES: Array<[mode: Mode, query: string | undefined]> = [['blank', undefined], ['seeded', SEEDED]];

const TITLES: Record<BookingScreen, string> = {
  symptoms: 'Tell us what’s wrong',
  'safety-check': 'Quick safety check',
  identity: 'Verify it’s you',
  'nhs-gp': 'Your NHS GP',
  quote: 'Your price, in full',
  finding: 'Finding your GP',
  ready: 'Your GP is ready',
  call: 'Your consultation',
  outcome: 'Your outcome',
  done: 'All done',
  'red-flag': 'Call 999 now',
  'consent-refused': 'Without your NHS record',
  'no-gp-available': 'No GP available right now',
  cancelled: 'Request cancelled',
  'payment-failed': 'Payment didn’t go through',
  'ended-early': 'The call ended early',
};

// The screens a first patient cannot have reached: nothing clinical is invented for them.
const NOTHING_YET_TITLES: Partial<Record<BookingScreen, string>> = {
  ready: 'No GP matched yet',
  call: 'No consultation in progress',
  outcome: 'No outcome yet',
  done: 'Nothing to show yet',
  'ended-early': 'No call yet',
};

const startClock = () => { vi.useFakeTimers(); vi.setSystemTime(T0); };
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const root = () => document.querySelector<HTMLElement>('[data-screen]')!;
const shownScreen = () => root().dataset.screen;
const h1 = () => screen.getByRole('heading', { level: 1 });
const button = (name: string) => screen.getByRole('button', { name });
const press = (name: string) => fireEvent.click(button(name));
const choose = (label: string) => fireEvent.click(screen.getByText(label, { selector: '[data-slot="choice-row"] > span' }));
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const amount = () => root().querySelector('[data-slot="quote-amount"]')?.textContent;
const fact = (label: string) => within(root()).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
const dockButtons = () =>
  within(root().querySelector<HTMLElement>('[data-slot="action-dock"]')!).getAllByRole('button').map((b) => b.textContent);
const confirmIn = (title: string, confirm: string) => {
  const dialog = screen.getByRole('dialog', { name: title });
  fireEvent.click(within(dialog).getByRole('button', { name: confirm }));
};

// The account's history, read beside the flow.
function HistoryProbe() {
  const { history } = usePatient();
  return <output data-testid="history">{JSON.stringify(history)}</output>;
}
const history = (): ConsultationRow[] => JSON.parse(screen.getByTestId('history').textContent ?? '[]');

// A first patient types the practice; a returning patient's is on file.
function answerNhsGp(consent: boolean) {
  if (field('GP practice name').value === '') {
    type('GP practice name', 'Example Surgery');
    type('Practice postcode', 'N1 9AA');
  }
  press(consent ? 'Yes, share with my NHS GP' : 'No, don’t share');
}

// Quote → finding once the hold lands → ready with the queue skipped. Needs startClock().
function requestAndMatch(price: string) {
  press(`Request a GP for ${price}`);
  tick(AUTHORISE_MS);
  expect(shownScreen()).toBe('finding');
  press('Prototype: skip the wait');
  expect(shownScreen()).toBe('ready');
}

// Ready → the call → ended `seconds` after joining, confirmed. Needs startClock().
function callFor(seconds: number) {
  press('Join the call');
  tick(seconds * 1000);
  press('End call');
  confirmIn('End the call?', 'End call');
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const firstFocusableAfter = (el: Element) =>
  [...document.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .find((candidate) => (el.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);

beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe.each(MODES)('every screen landed by URL, %s', (mode, query) => {
  test.each([...BOOKING_SCREENS])('%s renders one h1 in one root whose data-screen names it', (id) => {
    renderBooking(id, { query });
    const roots = document.querySelectorAll<HTMLElement>('[data-screen]');
    expect(roots).toHaveLength(1);
    expect(roots[0].dataset.screen).toBe(id);
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    const nothingYet = mode === 'blank' ? NOTHING_YET_TITLES[id] : undefined;
    expect(h1().textContent).toBe(nothingYet ?? TITLES[id]);
    if (nothingYet) {
      expect(within(roots[0]).getByText(NOTHING_YET)).toBeInTheDocument();
      expect(button('Start a consultation')).toBeInTheDocument();
      expect(document.querySelector('[data-slot="consult-clock"]')).toBeNull();
      expect(document.body.textContent).not.toMatch(/GP-0\d\d/);
    } else {
      expect(screen.queryByText(NOTHING_YET)).toBeNull();
    }
  });
});

test('an empty screen’s "Start a consultation" begins a fresh booking at symptoms', () => {
  renderBooking('done');
  press('Start a consultation');
  expect(shownScreen()).toBe('symptoms');
  expect(nav.router.replace).toHaveBeenCalledWith('/patient/book/symptoms');
});

describe('symptoms', () => {
  test.each(MODES)('nothing is preselected for the patient (%s)', (_mode, query) => {
    renderBooking('symptoms', { query });
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(7);   // four symptoms, three durations
    for (const radio of radios) expect(radio).not.toBeChecked();
    expect(field('Anything else the GP should know?')).toHaveValue('');
  });

  test('Continue with nothing chosen: both errors as alerts, the first radio takes focus, the screen stays', () => {
    renderBooking('symptoms');
    press('Continue');
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([COMPLAINT_ERROR, DURATION_ERROR]);
    expect(screen.getByRole('radiogroup', { name: 'Main symptom' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('radiogroup', { name: 'How long have you had it?' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('radio')[0]).toHaveFocus();
    expect(shownScreen()).toBe('symptoms');
  });

  test('"Something else" needs a few words: under 3 characters shows DETAILS_ERROR and the hint says why; 3 characters go on', () => {
    renderBooking('symptoms');
    const hint = () => document.getElementById('details-hint');
    expect(hint()).toHaveTextContent('Optional.');
    choose('Something else');
    expect(hint()).toHaveTextContent('Needed when you pick ‘Something else’, so the GP knows what to expect.');
    choose('Today');
    type('Anything else the GP should know?', 'ab');
    press('Continue');
    expect(shownScreen()).toBe('symptoms');
    expect(screen.getByRole('alert')).toHaveTextContent(DETAILS_ERROR);
    expect(field('Anything else the GP should know?')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Anything else the GP should know?')).toHaveFocus();
    type('Anything else the GP should know?', 'abc');
    expect(screen.queryByRole('alert')).toBeNull();
    press('Continue');
    expect(shownScreen()).toBe('safety-check');
  });
});

describe('safety-check', () => {
  test('ticking a flag relabels the one button and puts 999 up at once; submitting names that flag on red-flag', () => {
    renderBooking('safety-check');
    expect(dockButtons()).toEqual(['None of these — continue']);
    expect(screen.queryByRole('alert')).toBeNull();
    choose('Severe difficulty breathing');
    expect(dockButtons()).toEqual(['Continue — this needs emergency care']);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('link', { name: 'Call 999' })).toHaveAttribute('href', 'tel:999');
    press('Continue — this needs emergency care');
    expect(shownScreen()).toBe('red-flag');
    const told = screen.getByText('You told us:');
    const list = told.nextElementSibling as HTMLElement;
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Severe difficulty breathing']);
  });

  test('with nothing ticked (or a tick taken back) the button reads "None of these — continue" and goes to identity', () => {
    renderBooking('safety-check');
    choose('Chest pain or pressure');
    choose('Chest pain or pressure');
    expect(dockButtons()).toEqual(['None of these — continue']);
    expect(screen.queryByRole('alert')).toBeNull();
    press('None of these — continue');
    expect(shownScreen()).toBe('identity');
  });
});

describe('red-flag', () => {
  test('after a ticked flag: focus is on the h1, the tel:999 link is the first focusable element after it, nothing has been charged', () => {
    renderBooking('safety-check');
    choose('Chest pain or pressure');
    press('Continue — this needs emergency care');
    expect(h1()).toHaveFocus();
    const tel = screen.getByRole('link', { name: 'Call 999' });
    expect(tel).toHaveAttribute('href', 'tel:999');
    expect(firstFocusableAfter(h1())).toBe(tel);
    expect(screen.getByText('What you told us needs emergency care, not a video consultation.')).toBeInTheDocument();
    expect(root()).toHaveTextContent('Nothing has been charged.');
  });

  test('landed by URL with no flags: the generic lead and no "You told us:" list; 999 still comes first', () => {
    renderBooking('red-flag');
    expect(screen.getByText('Anything on the safety check needs emergency care, not a video consultation.')).toBeInTheDocument();
    expect(screen.queryByText('You told us:')).toBeNull();
    expect(within(root()).queryByRole('list')).toBeNull();
    const tel = screen.getByRole('link', { name: 'Call 999' });
    expect(tel).toHaveAttribute('href', 'tel:999');
    expect(firstFocusableAfter(h1())).toBe(tel);
    expect(root()).toHaveTextContent('Nothing has been charged.');
  });
});

describe('identity', () => {
  test('blank: "Verify identity" goes busy as "Checking your ID…", and the NHS GP screen follows after IDENTITY_CHECK_MS', () => {
    startClock();
    renderBooking('identity');
    expect(screen.getByRole('heading', { level: 2, name: 'Photo ID and a selfie' })).toBeInTheDocument();
    press('Verify identity');
    const busy = button('Checking your ID…');
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).toBeDisabled();
    tick(IDENTITY_CHECK_MS - 1);
    expect(shownScreen()).toBe('identity');
    tick(1);
    expect(shownScreen()).toBe('nhs-gp');
    expect(h1()).toHaveTextContent('Your NHS GP');
  });

  test('seeded: "Photo ID already verified" and a Continue that goes straight on', () => {
    renderBooking('identity', { query: SEEDED });
    expect(screen.getByRole('heading', { level: 2, name: 'Photo ID already verified' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify identity' })).toBeNull();
    press('Continue');
    expect(shownScreen()).toBe('nhs-gp');
  });
});

describe('nhs-gp', () => {
  test('seeded fields are prefilled from the account; blank fields are empty', () => {
    renderBooking('nhs-gp', { query: SEEDED });
    expect(field('GP practice name')).toHaveValue(PATIENT_ACCOUNT.nhsPractice);
    expect(field('Practice postcode')).toHaveValue('N1 9AA');
    cleanup();
    renderBooking('nhs-gp');
    expect(field('GP practice name')).toHaveValue('');
    expect(field('Practice postcode')).toHaveValue('');
  });

  test('an empty practice and a bad postcode keep the screen: both errors, both fields aria-invalid, no answer recorded', () => {
    renderBooking('nhs-gp');
    type('Practice postcode', '12345');
    press('Yes, share with my NHS GP');
    expect(shownScreen()).toBe('nhs-gp');
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([PRACTICE_ERROR, POSTCODE_ERROR]);
    expect(field('GP practice name')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Practice postcode')).toHaveAttribute('aria-invalid', 'true');
    expect(field('GP practice name')).toHaveFocus();
    expect(fact('Summary shared')).toBe('—');   // the answer only counts with a valid form
  });

  test('"No, don’t share" goes to consent-refused, and "Change my answer" comes back with the answers kept', () => {
    renderBooking('nhs-gp', { query: SEEDED });
    press('No, don’t share');
    expect(shownScreen()).toBe('consent-refused');
    press('Change my answer');
    expect(shownScreen()).toBe('nhs-gp');
    expect(field('GP practice name')).toHaveValue(PATIENT_ACCOUNT.nhsPractice);
    expect(field('Practice postcode')).toHaveValue('N1 9AA');
  });

  test.each(MODES)('"Continue without sharing" reaches the quote at the same price sharing would have shown (%s)', (mode, query) => {
    const priceVia = (consent: boolean) => {
      cleanup();
      renderBooking('nhs-gp', { query });
      answerNhsGp(consent);
      if (!consent) {
        expect(shownScreen()).toBe('consent-refused');
        press('Continue without sharing');
      }
      expect(shownScreen()).toBe('quote');
      return amount();
    };
    const shared = priceVia(true);
    expect(priceVia(false)).toBe(shared);
    expect(shared).toBe(mode === 'seeded' ? '£40' : '£32');
  });

  test('refusing after the quote was seen leaves that quote as it was', () => {
    renderBooking('nhs-gp', { query: SEEDED });
    press('Yes, share with my NHS GP');
    expect(amount()).toBe('£40');
    press('Back');
    press('No, don’t share');
    press('Continue without sharing');
    expect(shownScreen()).toBe('quote');
    expect(amount()).toBe('£40');
  });
});

describe('quote', () => {
  test.each<[Mode, string | undefined, string, string]>([
    ['blank', undefined, '£32', '—'],
    ['seeded', SEEDED, '£40', 'about 3 minutes'],
  ])('%s: the amount, the wait beside it, what it covers, the hold, the button, and no pressure words', (_mode, query, price, wait) => {
    renderBooking('quote', { query });
    expect(amount()).toBe(price);
    const quoteCard = root().querySelector<HTMLElement>('[data-slot="price-quote"]')!;
    expect(quoteCard.querySelector('[data-slot="stat-value"]')?.textContent).toBe(wait);
    expect(within(quoteCard).getByText(PRICE.note)).toBeInTheDocument();
    expect(screen.getByText(
      `${price} is held on your card now, taken only when a GP accepts, and released in full if no GP is available.`,
    )).toBeInTheDocument();
    expect(button(`Request a GP for ${price}`)).toBeEnabled();
    expect(root().textContent).not.toMatch(/\b(surge|busy|busier|priority|hurry)\b/i);
  });

  test('a declined card: after AUTHORISE_MS payment-failed says the price still stands; "Try another card" returns to the same price', () => {
    startClock();
    renderBooking('quote', { query: SEEDED });
    press('Prototype: use a card that will be declined');
    expect(fact('Pay with')).toBe('Test card that will be declined');
    press('Request a GP for £40');
    expect(button('Holding £40…')).toHaveAttribute('aria-busy', 'true');
    tick(AUTHORISE_MS - 1);
    expect(shownScreen()).toBe('quote');
    tick(1);
    expect(shownScreen()).toBe('payment-failed');
    expect(screen.getByText('Your card was declined and nothing has been taken. Your price is still £40.')).toBeInTheDocument();
    press('Try another card');
    expect(shownScreen()).toBe('quote');
    expect(amount()).toBe('£40');
    expect(fact('Pay with')).toBe('Visa ending 4242');
    expect(button('Request a GP for £40')).toBeEnabled();
  });
});

describe('finding', () => {
  test('the hold line and the labelled progress bar', () => {
    renderBooking('finding', { query: SEEDED });
    expect(screen.getByText('£40 held on your card. Taken only when a GP accepts.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progress to the front of the queue' })).toBeInTheDocument();
  });

  test('Cancel request asks first; confirming cancels, says nothing was charged, and writes a £0 cancelled record', () => {
    renderPatient(<><BookingFlow /><HistoryProbe /></>, { pathname: '/patient/book/finding', query: SEEDED });
    press('Cancel request');
    const dialog = screen.getByRole('dialog', { name: 'Cancel your request?' });
    expect(within(dialog).getByRole('button', { name: 'Keep waiting' })).toHaveFocus();   // the safe choice first
    expect(dialog).toHaveTextContent('The £40 hold on your card is released in full, so nothing is charged.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel request' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(shownScreen()).toBe('cancelled');
    expect(screen.getByText('Your place in the queue is released and the £40 hold is gone. Nothing has been charged.')).toBeInTheDocument();
    expect(history()[0]).toMatchObject({ id: 'C-0032', status: 'cancelled', cost: 0, gp: null, outcome: null, isNew: true });
  });

  test('"Keep waiting" closes the dialog and the request stands', () => {
    renderBooking('finding', { query: SEEDED });
    press('Cancel request');
    confirmIn('Cancel your request?', 'Keep waiting');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(shownScreen()).toBe('finding');
  });

  test('"Prototype: skip the wait" goes to ready', () => {
    renderBooking('finding', { query: SEEDED });
    press('Prototype: skip the wait');
    expect(shownScreen()).toBe('ready');
    expect(h1()).toHaveTextContent('Your GP is ready');
  });

  test('"Prototype: no GP available": the hold is released in full, 111 is offered, and "Try again" goes back to the quote', () => {
    renderBooking('finding', { query: SEEDED });
    press('Prototype: no GP available');
    expect(shownScreen()).toBe('no-gp-available');
    expect(screen.getByText('The £40 hold on your card has been released in full. You have not been charged.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call 111' })).toHaveAttribute('href', 'tel:111');
    press('Try again');
    expect(shownScreen()).toBe('quote');
    expect(amount()).toBe('£40');
  });
});

describe('ready', () => {
  const card = () => root().querySelector<HTMLElement>('[data-slot="gp-card"]')!;

  test('seeded: the GP card names GP-002 with the four reasons it was matched; the price taken is the price shown', () => {
    renderBooking('ready', { query: SEEDED });
    expect(card()).toHaveTextContent('GP-002');
    const reasons = matchGp(GPS, PRESCRIBING)!.reasons;
    expect(reasons).toHaveLength(4);
    const list = within(card()).getByRole('list', { name: 'Why this GP' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(reasons);
    expect(screen.getByText('£40 taken from your card, the price you were shown.')).toBeInTheDocument();
    expect(card()).not.toHaveTextContent('NHS record');   // the record was shared: no limit to state
  });

  test('seeded: the card shows the GP’s rating as an average and a count, and still no name', () => {
    renderBooking('ready', { query: SEEDED });
    const rating = card().querySelector<HTMLElement>('[data-slot="gp-rating"]')!;
    expect(rating).toHaveTextContent('4.8');
    expect(rating).toHaveTextContent('60 ratings');
    expect(card()).not.toHaveTextContent(/Dr\.? [A-Z][a-z]/);
  });

  test('blank: a first patient’s GP shows no rating, because nobody has given one', () => {
    renderBooking('finding');
    press('Prototype: skip the wait');
    expect(shownScreen()).toBe('ready');
    expect(card().querySelector('[data-slot="gp-rating"]')).toBeNull();
  });

  test('consent refused on the way (nhs-gp → No → Continue without sharing): the card names the choice and its cost', () => {
    startClock();
    renderBooking('nhs-gp', { query: SEEDED });
    answerNhsGp(false);
    press('Continue without sharing');
    requestAndMatch('£40');
    expect(card()).toHaveTextContent('You chose not to share your NHS record, so GP-002 may be unable to prescribe some treatments.');
  });

  test('a blank landing on finding never asked for consent: after the skip the GP "does not have your NHS record"', () => {
    renderBooking('finding');
    press('Prototype: skip the wait');
    expect(shownScreen()).toBe('ready');
    expect(card()).toHaveTextContent('Your GP does not have your NHS record, so they may be unable to prescribe some treatments.');
  });
});

describe('call', () => {
  const clock = () => root().querySelector('[data-slot="consult-clock"]')?.textContent;

  test('the call is not recorded, and its clock counts from the join: 00:00, then 01:05 after 65s', () => {
    startClock();
    renderBooking('call', { query: SEEDED });
    expect(screen.getByText('This call is not recorded.')).toBeInTheDocument();
    expect(clock()).toBe('00:00');
    tick(65_000);
    expect(clock()).toBe('01:05');
  });

  test.each<[number, BookingScreen]>([
    [45, 'ended-early'],
    [119, 'ended-early'],
    [120, 'outcome'],
  ])('End call asks first; confirmed %ss in, the call goes to %s', (seconds, next) => {
    startClock();
    renderBooking('call', { query: SEEDED });
    tick(seconds * 1000);
    press('End call');
    confirmIn('End the call?', 'End call');
    expect(shownScreen()).toBe(next);
    if (next === 'ended-early') {
      const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      expect(screen.getByText(`The call lasted ${mmss}. Your GP will still complete your summary.`)).toBeInTheDocument();
      expect(root().textContent).not.toContain('£');   // whether a short call is refunded is undecided
      press('Continue');
      expect(shownScreen()).toBe('outcome');
    }
  });

  test('"Back to the call" has focus when the dialog opens, and keeps the call going', () => {
    renderBooking('call', { query: SEEDED });
    press('End call');
    expect(within(screen.getByRole('dialog', { name: 'End the call?' })).getByRole('button', { name: 'Back to the call' })).toHaveFocus();
    confirmIn('End the call?', 'Back to the call');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(shownScreen()).toBe('call');
  });
});

describe('outcome', () => {
  test('seeded sore throat with the record shared: a prescription sent to the pharmacy on file, and no £ on the screen', () => {
    renderBooking('outcome', { query: SEEDED });
    expect(screen.getByRole('heading', { level: 2, name: 'Your GP has written a prescription.' })).toBeInTheDocument();
    expect(fact('Prescription')).toBe('Sent to your pharmacy');
    expect(root()).toHaveTextContent(`It has been sent to ${PATIENT_ACCOUNT.pharmacy}.`);
    expect(root().textContent).not.toContain('£');
  });

  test('consent refused: a referral to the NHS GP and no prescription, and no £ on the screen', () => {
    startClock();
    renderBooking('nhs-gp', { query: SEEDED });
    answerNhsGp(false);
    press('Continue without sharing');
    requestAndMatch('£40');
    callFor(130);
    expect(shownScreen()).toBe('outcome');
    expect(fact('Referral')).toBe('To your NHS GP');
    expect(fact('Prescription')).toBe('None issued');
    expect(fact('NHS GP summary')).toBe('Not sent. You chose not to share.');
    expect(root()).not.toHaveTextContent('Your GP has written a prescription.');
    expect(root().textContent).not.toContain('£');
  });
});

describe('done', () => {
  test('after a real seeded completion: "Saved to your account as C-0032." and Paid £40', () => {
    renderBooking('outcome', { query: SEEDED });
    press('Continue');
    expect(shownScreen()).toBe('done');
    expect(root()).toHaveTextContent('Saved to your account as C-0032.');
    expect(fact('Reference')).toBe('C-0032');
    expect(fact('Paid')).toBe('£40');
    expect(fact('Recording')).toBe('Not recorded');
  });

  test('a seeded URL landing previews the receipt without claiming it was saved', () => {
    renderBooking('done', { query: SEEDED });
    expect(fact('Reference')).toBe('C-0032');
    expect(fact('GP')).toBe('GP-002');
    expect(fact('Length')).toBe('9 minutes');
    expect(fact('Paid')).toBe('£40');
    expect(root()).not.toHaveTextContent('Saved to your account');
    expect(screen.getByText('You’ll get a summary by email.')).toBeInTheDocument();
  });

  test('after a consultation the patient is asked to rate it, once, and thanked', () => {
    renderBooking('outcome', { query: SEEDED });
    press('Continue');
    const group = screen.getByRole('radiogroup', { name: 'How was your consultation?' });
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    fireEvent.click(within(group).getByRole('radio', { name: '4 stars' }));
    expect(root()).toHaveTextContent('Thank you.');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  test('a URL landing is not a consultation, so it is not asked to rate one', () => {
    renderBooking('done', { query: SEEDED });
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  test('a blank URL landing shows NOTHING_YET and no receipt', () => {
    renderBooking('done');
    expect(h1()).toHaveTextContent('Nothing to show yet');
    expect(within(root()).getByText(NOTHING_YET)).toBeInTheDocument();
    expect(root().querySelector('[data-slot="facts"]')).toBeNull();
  });
});

test('the quote is one number: a full seeded walk from symptoms to done shows only £40, and only on quote, finding, ready and done', () => {
  startClock();
  renderBooking('symptoms', { query: SEEDED });
  const amounts: Array<[string | undefined, string[]]> = [];
  const collect = () => { amounts.push([shownScreen(), root().textContent?.match(/£\d+/g) ?? []]); };
  collect();
  choose('Sore throat or cough');
  choose('2–3 days');
  press('Continue');
  collect();
  press('None of these — continue');
  collect();
  press('Continue');                        // photo ID on file
  collect();
  press('Yes, share with my NHS GP');       // the practice on file
  collect();
  press('Request a GP for £40');
  tick(AUTHORISE_MS);
  collect();
  press('Prototype: skip the wait');
  collect();
  press('Join the call');
  collect();
  tick(545_000);
  press('End call');
  confirmIn('End the call?', 'End call');
  collect();
  press('Continue');
  collect();
  expect(amounts.map(([id]) => id)).toEqual([
    'symptoms', 'safety-check', 'identity', 'nhs-gp', 'quote', 'finding', 'ready', 'call', 'outcome', 'done',
  ]);
  const priced = new Set(['quote', 'finding', 'ready', 'done']);
  for (const [id, seen] of amounts) {
    if (priced.has(id!)) {
      expect(seen.length, id).toBeGreaterThan(0);
      expect(new Set(seen), id).toEqual(new Set(['£40']));
    } else {
      expect(seen, id).toEqual([]);
    }
  }
});
