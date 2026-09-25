// One skeleton for both modes. The symmetry is what makes the equal-billing
// decision read visually (CLAUDE.md); do not fork the shape. The hero is two
// bento cells: a white tile carrying the headline, sub and capture, and the
// art slot beside it (HeroTiles in both modes). The capture is passed in rather
// than built here: the patient mode's is one email field and the GP's is a
// four-field sign-up, but the headline, sub and art around them are the same
// shape in both.
export function Hero({ headerId, lines, sub, form, art }: {
  headerId?: string;
  lines: [string, string];
  sub: string;
  form: React.ReactNode;
  art: React.ReactNode;
}) {
  return (
    <header className="hero pt-4 pb-4" id={headerId}>
      <div className="wrap grid grid-cols-[1.15fr_.85fr] gap-4 items-stretch max-cols:grid-cols-1">
        <div className="hero-copy flex flex-col justify-center rounded-2xl bg-white shadow-card px-tile-lead-pad py-hero-t max-phone:px-6 max-phone:py-10">
          <h1 tabIndex={-1}>
            <span className="ln" data-line><span>{lines[0]}</span></span>
            <span className="ln" data-line><span>{lines[1]}</span></span>
          </h1>
          <p className="sub text-lead leading-[1.55] text-ink-2 max-w-[40ch] mt-5 mb-9" data-reveal="load">{sub}</p>
          {form}
        </div>
        {art}
      </div>
    </header>
  );
}
