import { test, expect, describe } from 'vitest';
import { APPROVED_CQC, PUBLIC_COPY_RULES, checkCopy } from '@/lib/compliance';

describe('each public copy rule bites', () => {
  test.each(PUBLIC_COPY_RULES.map((r) => [r.id, r] as const))('%s catches its sample', (_id, rule) => {
    expect(checkCopy(rule.sample).map((h) => h.rule)).toContain(rule.id);
  });
});

test('a medicine is caught as a word, in any case, with its position', () => {
  const text = 'Most sore throats clear up without Amoxicillin.';
  expect(checkCopy(text)).toEqual([
    { rule: 'medicine', phrase: 'Amoxicillin', index: text.indexOf('Amoxicillin'), why: expect.stringMatching(/illegal/) },
  ]);
});

test('ordinary prose passes: surgery, busy lives, priorities, Dr Quick and the approved CQC sentence', () => {
  const prose = [
    'Your GP surgery may be closed at the weekend.',
    'For busy parents, a video call fits around the school run.',
    'Your health is our priority.',
    'Dr Quick is a private GP service in England.',
    `Dr Quick is a ${APPROVED_CQC}.`,
    'Your price is shown in full before you book, and never changes after.',
    'Any prescription you need is sent to a pharmacy you choose; the pharmacy charges separately.',
    'Call 999 or go to A&E in an emergency, or call 111 if you are not sure.',
  ];
  for (const line of prose) expect(checkCopy(line), line).toEqual([]);
});

test('a price range is reported once, as the range, not again as an amount', () => {
  const hits = checkCopy('Consultations from £32.');
  expect(hits.map((h) => h.rule)).toEqual(['price-range']);
});

test('hits come back in reading order', () => {
  const hits = checkCopy('We are CQC registered. Prescriptions included. Dr Patel will see you.');
  expect(hits.map((h) => h.rule)).toEqual(['cqc', 'prescriptions-included', 'named-doctor']);
  expect(hits.map((h) => h.index)).toEqual([...hits.map((h) => h.index)].sort((a, b) => a - b));
});
