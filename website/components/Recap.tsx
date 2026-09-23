// The closing capture. Same collapse point as the hero's sibling (1080px):
// below it this grid squeezes the fields narrower than a phone gets.
export function Recap({ headingId, title, sub, form }: {
  headingId: string;
  title: string;
  sub: string;
  form: React.ReactNode;
}) {
  return (
    <section className="recap border-t border-rule py-section" aria-labelledby={headingId}>
      <div className="wrap grid grid-cols-2 gap-recap-gap items-start max-forms:grid-cols-1 max-forms:gap-0">
        <h2 id={headingId} data-reveal className="max-w-[14ch]">{title}</h2>
        <p className="sub text-lead leading-[1.55] text-ink-2 max-w-[34ch] mt-5" data-reveal>{sub}</p>
        {form}
      </div>
    </section>
  );
}
