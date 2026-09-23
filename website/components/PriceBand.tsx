// The money, read against a known scope. The light variant is the patient price
// band; the slate 'field' variant is the GP pay band — the dark fill sits on
// the payoff, which for a GP is what a consultation pays. Pricing is dynamic, so
// neither band carries a figure: the promise is that the figure arrives before
// you commit, not that it never moves.
export function PriceBand({ variant, headingId, headline, fine }: {
  variant: 'price' | 'pay';
  headingId: string;
  headline: React.ReactNode;
  fine: string;
}) {
  const section = variant === 'price'
    ? 'price border-t border-rule pt-section-open pb-section'
    : 'field pay band-grid bg-band text-white py-field-section';
  return (
    <section className={section} aria-labelledby={headingId}>
      <div className="wrap grid grid-cols-[1.55fr_1fr] gap-x-16 gap-y-8 items-end max-cols:grid-cols-1 max-cols:items-start">
        <h2 id={headingId} data-reveal className={`tabular-nums ${variant === 'price' ? 'max-w-[20ch]' : 'max-w-[22ch]'}`}>
          {headline}
        </h2>
        <p data-reveal className={`fine text-body max-w-[34ch] ${variant === 'price' ? 'text-ink-2' : 'text-band-ink-2 max-w-[36ch]'}`}>
          {fine}
        </p>
      </div>
    </section>
  );
}
