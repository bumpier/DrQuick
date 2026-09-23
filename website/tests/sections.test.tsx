// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Steps } from '@/components/Steps';
import { Covers } from '@/components/Covers';
import { PriceBand } from '@/components/PriceBand';
import { PATIENT_STEPS, PATIENT_COVERS, GP_COVERS } from '@/app/landing-content';

test('the bento varies: two setup tiles, one full-width dark payoff, third in sequence', () => {
  const { container } = render(<Steps headingId="t" title="As simple as it sounds." tiles={PATIENT_STEPS} />);
  const tiles = [...container.querySelectorAll('.bento > div')];
  expect(tiles).toHaveLength(3);
  expect(tiles[0].className).toContain('col-span-3');
  expect(tiles[2].className).toContain('bg-band');
  expect(tiles[2].className).toContain('col-span-6');
  expect(tiles[2]).toHaveTextContent('Talk by video.');
});

test('covers renders five items per column with the right marks and tone', () => {
  const { container } = render(<Covers headingId="c" title="t" cols={PATIENT_COVERS} />);
  const cols = [...container.querySelectorAll('[data-stagger] > div')];
  expect(cols).toHaveLength(2);
  expect(cols[0].querySelectorAll('use[href="#i-yes"]')).toHaveLength(5);
  expect(cols[1].querySelectorAll('use[href="#i-no"]')).toHaveLength(5);
  expect(cols[1].querySelector('li')!.className).toContain('text-ink-2');
});

test('the compliance sentences survive in the covers copy', () => {
  const patientNo = PATIENT_COVERS[1].items.join(' ');
  expect(patientNo).toContain('Schedule 2 and 3');
  expect(patientNo).toContain('call 999');
  const gpNo = GP_COVERS[1].items.join(' ');
  expect(gpNo).toContain('Schedule 2 or 3');
  expect(gpNo).toContain('Scotland, Wales and Northern Ireland');
});

test('the price band puts the promise in the accent and stays tabular', () => {
  const { container } = render(
    <PriceBand variant="price" headingId="p" fine="fine"
      headline={<><b className="text-primary">Your price in full</b>, before you book.</>} />,
  );
  expect(container.querySelector('h2 b')!.className).toContain('text-primary');
  expect(container.querySelector('h2')!.className).toContain('tabular-nums');
  const { container: pay } = render(
    <PriceBand variant="pay" headingId="g" fine="fine"
      headline={<><b className="text-primary-lift">Paid more</b> when demand is high.</>} />,
  );
  expect(pay.querySelector('section')!.className).toContain('bg-band');
  expect(pay.querySelector('h2 b')!.className).toContain('text-primary-lift');
});
