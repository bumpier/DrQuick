// Money is integer pence in GBP everywhere in the database; this is the one
// place it becomes pounds for a screen. The admin only: the patient surface
// formats its frozen quote through lib/pricing's money().
const WHOLE = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function gbp(pence: number | null | undefined): string {
  const value = Number.isFinite(pence) ? Number(pence) : 0;
  return WHOLE.format(Math.round(value) / 100);
}
