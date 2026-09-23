// The Capped Stagger Rule (DESIGN.md): siblings arrive 70ms apart, but the
// total delay is capped so a long list never turns into a queue. The hero's
// load-time elements pace at 90ms and are few enough to need no cap.
export const REVEAL_STEP = 70;
export const REVEAL_CAP = 300;
export const HERO_STEP = 90;

export const staggerDelay = (i: number): number => Math.min(i * REVEAL_STEP, REVEAL_CAP);
export const heroDelay = (i: number): number => i * HERO_STEP;
