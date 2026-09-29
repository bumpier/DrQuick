// The money, read against a known scope, as one wide bento tile. The patient
// price tile is lime; the GP pay tile is the forest band — the dark fill sits on
// the payoff, which for a GP is what a consultation pays. Pricing is dynamic, so
// neither tile carries a figure: the promise is that the figure arrives before
// you commit, not that it never moves.
export function PriceBand({ variant, headingId, section, headline, fine }: {
  variant: 'price' | 'pay';
  headingId: string;
  section?: string;
  headline: React.ReactNode;
  fine: string;
}) {
  const tile = variant === 'price'
    ? 'bg-primary text-ink'
    : 'band-grid bg-band text-white';
  return (
    <section className={`${variant} pt-section`} aria-labelledby={headingId} data-section={section}>
      <div className="wrap">
        <div data-reveal
          className={`${tile} rounded-2xl px-tile-lead-pad py-field-section grid grid-cols-[1.55fr_1fr] gap-x-16 gap-y-8 items-end max-cols:grid-cols-1 max-cols:items-start max-phone:px-6`}>
          <h2 id={headingId} className={`tabular-nums ${variant === 'price' ? 'max-w-[20ch]' : 'max-w-[22ch]'}`}>
            {headline}
          </h2>
          <p className={`fine text-body max-w-[34ch] ${variant === 'price' ? 'text-ink' : 'text-band-ink-2 max-w-[36ch]'}`}>
            {fine}
          </p>
        </div>
      </div>
    </section>
  );
}
