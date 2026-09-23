/* What one consultation costs, quoted for one booking.

   Pricing moves with demand over supply (decided 2026-09-04): the more
   patients waiting against the GPs online, the higher the quote. The business
   plan models a base off-peak price of 32 pounds, so the quote starts there and
   climbs one step per place in the queue beyond the first — the same
   `waitEstimate` the patient's queue position is read from, so the price and
   the wait it is quoted beside always tell one story about the floor.

   The step and the cap are PROTOTYPE PLACEHOLDERS, not product decisions:
   PRODUCT.md records the floor, the ceiling and the multiplier as undecided.
   Nothing here relates to what the GP is paid for the same consultation
   (OFFER.fee); that relationship is undecided too.

   A quote is computed once, when the patient reaches the quote screen, and is
   then frozen into the booking. Nothing after that moment may change it: the
   law (DMCC Act 2024) requires the full price before the patient commits and
   forbids it moving afterwards. Dynamic between bookings is defensible; within
   one it is not. */
import { FLOOR } from '@/lib/fixtures';
import { waitEstimate, type Floor } from '@/lib/booking';

export const BASE_PRICE = 32;   // the plan's base off-peak consult price
export const PRICE_STEP = 4;    // per place in the queue beyond the first
export const PRICE_CAP = 48;    // placeholder ceiling; see the note above

/* Nothing has launched, so the first patient joins an empty floor: nobody
   waiting, and the quote is the base price. Seeded mode quotes from the
   fixture floor the dashboards were designed on. */
export const EMPTY_FLOOR: Floor = { waiting: 0, gpsOnline: 0 };

export function floorFor(seeded: boolean): Floor {
  return seeded ? FLOOR : EMPTY_FLOOR;
}

export function quoteFor(floor: Floor): number {
  const { position } = waitEstimate(floor);
  return Math.min(PRICE_CAP, BASE_PRICE + PRICE_STEP * (position - 1));
}
