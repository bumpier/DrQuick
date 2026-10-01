// The money, read against a known scope, as one wide bento tile. The patient
// price tile is lime; the GP pay tile is the forest band — the dark fill sits on
// the payoff, which for a GP is what a consultation pays.
//
// The patient tile carries no figure: pricing is dynamic, so the promise is
// that the figure arrives before you commit, not that it never moves. The GP
// tile does carry one, because a GP's share of that price is fixed
// (lib/finance/commission.ts): it passes the ladder as `aside`, and the words
// stack beside it.
export function PriceBand({ variant, headingId, section, headline, fine, aside }: {
  variant: 'price' | 'pay';
  headingId: string;
  section?: string;
  headline: React.ReactNode;
  fine: string;
  aside?: React.ReactNode;
}) {
  const tile = variant === 'price'
    ? 'bg-primary text-ink'
    : 'band-grid bg-band text-white';
  const heading = (
    <h2 id={headingId} className={`tabular-nums ${variant === 'price' ? 'max-w-[20ch]' : 'max-w-[22ch]'}`}>
      {headline}
    </h2>
  );
  const measure = aside ? 'max-w-[44ch] mt-6' : variant === 'price' ? 'max-w-[34ch]' : 'max-w-[36ch]';
  const small = (
    <p className={`fine text-body ${measure} ${variant === 'price' ? 'text-ink' : 'text-band-ink-2'}`}>
      {fine}
    </p>
  );
  return (
    <section className={`${variant} pt-section`} aria-labelledby={headingId} data-section={section}>
      <div className="wrap">
        <div data-reveal
          className={`${tile} rounded-2xl px-tile-lead-pad py-field-section grid ${aside ? 'grid-cols-[1.15fr_1fr]' : 'grid-cols-[1.55fr_1fr]'} gap-x-16 gap-y-10 items-end max-cols:grid-cols-1 max-cols:items-start max-phone:px-6`}>
          {aside ? <><div>{heading}{small}</div>{aside}</> : <>{heading}{small}</>}
        </div>
      </div>
    </section>
  );
}
