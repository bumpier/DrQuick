// What a GP keeps of each consultation. Decided by the user on 2026-10-01,
// settling PRODUCT.md's open question about how the GP's pay relates to the
// patient's price: it is a share of that price, and the share rises with the
// number of consultations the GP has completed.
//
//   consultations 1 to 100     the GP keeps 60%, Dr Quick 40%
//   consultations 101 to 500   the GP keeps 70%, Dr Quick 30%
//   consultation 501 onwards   the GP keeps 75%, Dr Quick 25% (the top)
//
// "Served" is a GP's lifetime count of COMPLETED consultations. It never
// resets, and a cancelled or no-show consultation does not count. The tier a
// consultation is paid at is the one the GP held when it was accepted: reaching
// 100 changes the next consultation, never the ones already done.
//
// Pure, with no imports, so the landing page, the sign-up pop-up, the admin and
// the demo data can all read the same rule. Shares are whole basis points and
// money is integer pence, so nothing here is a float that could drift.

export type CommissionTier = {
  /** Completed consultations a GP needs before this tier applies. */
  from: number;
  /** The GP's share of the consultation price, in basis points. */
  gpShareBps: number;
};

export const COMMISSION_TIERS: readonly [CommissionTier, CommissionTier, CommissionTier] = [
  { from: 0, gpShareBps: 6000 },
  { from: 100, gpShareBps: 7000 },
  { from: 500, gpShareBps: 7500 },
];

const count = (served: number) => (Number.isFinite(served) ? Math.max(0, Math.floor(served)) : 0);

/** The tier a GP who has completed `served` consultations is on. */
export function tierFor(served: number): CommissionTier {
  const n = count(served);
  let tier: CommissionTier = COMMISSION_TIERS[0];
  for (const t of COMMISSION_TIERS) if (n >= t.from) tier = t;
  return tier;
}

/** The next tier up and how many more consultations reach it; null at the top. */
export function nextTier(served: number): { tier: CommissionTier; remaining: number } | null {
  const n = count(served);
  const tier = COMMISSION_TIERS.find((t) => t.from > n);
  return tier ? { tier, remaining: tier.from - n } : null;
}

export const gpSharePercent = (tier: CommissionTier) => tier.gpShareBps / 100;
export const platformSharePercent = (tier: CommissionTier) => 100 - tier.gpShareBps / 100;

/**
 * One consultation's price divided between the GP and Dr Quick. `servedBefore`
 * is the GP's completed count before this consultation. The GP's fee is rounded
 * to the penny and Dr Quick takes the remainder, so the two always add up to
 * the price exactly.
 */
export function splitPrice(pricePence: number, servedBefore: number): { gpFeePence: number; platformFeePence: number } {
  const price = Math.max(0, Math.round(pricePence));
  const gpFeePence = Math.round((price * tierFor(servedBefore).gpShareBps) / 10_000);
  return { gpFeePence, platformFeePence: price - gpFeePence };
}
