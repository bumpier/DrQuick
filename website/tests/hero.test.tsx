// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Hero } from '@/components/Hero';
import { WaitlistForm } from '@/components/WaitlistForm';
import { GpSignupCta } from '@/components/GpSignupCta';
import { DEFAULT_ROLE, PATIENT_MODE } from '@/lib/site-mode';
import { HeroTiles } from '@/components/PhotoTile';
import { Nav } from '@/components/Nav';
import { UrgentBand } from '@/components/UrgentBand';

test('the hero skeleton is identical for both modes: masked lines, sub, form, art slot', () => {
  const { container } = render(
    <Hero lines={['See a GP', 'in minutes.']} sub="sub copy"
      form={<WaitlistForm role="patient" source="hero" cta="Join the waitlist" inputId="join" reveal="load" />}
      art={<div className="hero-art" data-reveal="load" />} />,
  );
  const h1 = container.querySelector('h1')!;
  expect(h1).toHaveAttribute('tabindex', '-1');
  expect(h1.querySelectorAll('.ln[data-line] > span')).toHaveLength(2);
  expect(container.querySelector('form[data-source="hero"] input[type="email"]')).toBeInTheDocument();
  expect(container.querySelector('.hero-art')).toBeInTheDocument();
});

// The capture is a slot, so the GP sign-up drops into the same skeleton the
// one-field capture uses: same masked lines, same sub, same art column. The
// form itself lives in the pop-up; what sits here is the button that opens it
// and the fee, named before the click.
test('the GP sign-up occupies that same slot without changing the skeleton', () => {
  const { container } = render(
    <Hero headerId="gps" lines={['Consult when', 'it suits you.']} sub="sub copy"
      form={<GpSignupCta source="hero-gp" id="gp-join" reveal="load" more={{ href: '#gp-pay-title', label: 'See what you keep' }} />}
      art={<div className="hero-art" data-reveal="load" />} />,
  );
  expect(container.querySelectorAll('h1 .ln[data-line] > span')).toHaveLength(2);
  expect(container.querySelector('.hero-art')).toBeInTheDocument();
  expect(container.querySelector('form')).toBeNull();
  // The nav CTA and the other pages link to #gp-join, so the id stays on the
  // button; `data-gp-signup` is what the pop-up listens for.
  const button = container.querySelector('button#gp-join')!;
  expect(button).toHaveTextContent('Sign up as a GP');
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveAttribute('data-gp-signup', 'hero-gp');
  expect(container.querySelector('.gp-cta')).toHaveAttribute('data-reveal', 'load');
  expect(container.querySelector('.gp-cta a')).toHaveAttribute('href', '#gp-pay-title');
});

test('the fee and how it comes back are stated beside the button, before any click', () => {
  const { container } = render(<GpSignupCta source="recap-gp" id="gp-join2" reveal="" />);
  expect(container.querySelector('.note')).toHaveTextContent(
    '£50 one-off sign-up fee. Refunded in full if we can’t verify your GMC registration or don’t take you on.',
  );
  expect(container.querySelector('button')).toHaveAttribute('data-gp-signup', 'recap-gp');
  expect(container.querySelector('a')).toBeNull(); // the "see what you keep" link is the hero's only
});

test('the hero tiles hold three photo slots, placeholders invent no people or captions', () => {
  const { container } = render(<HeroTiles tiles={[
    { slot: 'a', tone: 'wash', glyph: 'phone' },
    { slot: 'b', tone: 'stone', glyph: 'video' },
    { slot: 'c', tone: 'sage', glyph: 'home' },
  ]} />);
  const figures = [...container.querySelectorAll('.hero-art figure[data-photo]')];
  expect(figures.map((f) => f.getAttribute('data-photo'))).toEqual(['a', 'b', 'c']);
  expect(figures[0].className).toContain('row-span-2');
  for (const f of figures) {
    expect(f.querySelector('img')).toBeNull();
    expect(f.querySelector('figcaption')).toBeNull();
    expect(f.textContent).toBe('');
  }
});

test.skipIf(!PATIENT_MODE)('the nav carries the switch, both CTA labels and the sentinel contract', () => {
  const { container } = render(<Nav />);
  // The switch and the CTA are authored for the mode the page opens on, which
  // is the GP one: its link comes first and is current, and the CTA opens the
  // sign-up pop-up. Both labels still ship, for the runtime role to choose.
  expect(DEFAULT_ROLE).toBe('gp');
  const links = [...container.querySelectorAll('[data-mode-link]')];
  expect(links.map((a) => a.getAttribute('data-mode-link'))).toEqual(['gp', 'patient']);
  expect(links[0]).toHaveAttribute('aria-current', 'page');
  expect(links[1]).not.toHaveAttribute('aria-current');
  const cta = container.querySelector('#nav-cta')!;
  expect(cta).toHaveAttribute('href', '#gp-join');
  expect(cta).toHaveAttribute('data-gp-signup', 'nav-gp');
  expect(container.querySelector('.cta-p .cta-long')).toHaveTextContent('Join the waitlist');
  expect(container.querySelector('.cta-g .cta-long')).toHaveTextContent('Sign up');
});

// With one audience there is nothing to switch between, and the CTA is authored
// rather than left to the runtime role: without JS `data-role` is never set, so a
// role-dependent CTA would render the patient label and an #join target that is
// not on the page.
test.skipIf(PATIENT_MODE)('with one mode the nav drops the switch and authors the GP CTA', () => {
  const { container } = render(<Nav />);
  expect(container.querySelector('[data-mode-link]')).toBeNull();
  expect(container.querySelector('[data-slot="segmented-link-group"]')).toBeNull();
  const cta = container.querySelector('#nav-cta')!;
  expect(cta).toHaveAttribute('href', '#gp-join');
  expect(cta).toHaveTextContent('Sign up');
  expect(container.querySelector('.cta-p')).toBeNull();
});

test('the urgent band keeps 999 as a real tel: link at body size', () => {
  const { container } = render(<UrgentBand />);
  const tel = container.querySelector('a.tel')!;
  expect(tel).toHaveAttribute('href', 'tel:999');
  expect(tel).toHaveTextContent('call 999');
});
