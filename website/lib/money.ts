// Money is integer pence in GBP everywhere in the database; this is the one
// place it becomes pounds for a screen. The admin only: the patient surface
// formats its frozen quote through lib/pricing's money().
const WHOLE = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function gbp(pence: number | null | undefined): string {
  const value = Number.isFinite(pence) ? Number(pence) : 0;
  return WHOLE.format(Math.round(value) / 100);
}

// A short form for chart axes: 80000 pence is "£800", 8_000_000 is "£80k".
const COMPACT = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 });
export function gbpCompact(pence: number): string {
  return COMPACT.format(Math.round(pence) / 100);
}

// Pounds as a plain decimal for CSV: "1234.50", no symbol, no separators.
export const poundsDecimal = (pence: number) => (Math.round(pence) / 100).toFixed(2);
