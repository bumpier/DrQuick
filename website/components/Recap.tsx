// The closing capture, as one stone bento tile: warm enough to end on, and the
// lime button still stands clear of it. Same collapse point as the hero's
// sibling (1080px): below it this grid squeezes the fields narrower than a
// phone gets.
export function Recap({ headingId, section, title, sub, form }: {
  headingId: string;
  section?: string;
  title: string;
  sub: string;
  form: React.ReactNode;
}) {
  return (
    <section className="recap pt-section pb-section" aria-labelledby={headingId} data-section={section}>
      <div className="wrap">
        <div className="rounded-2xl bg-stone px-tile-lead-pad py-field-section grid grid-cols-2 gap-x-recap-gap items-start max-forms:grid-cols-1 max-forms:gap-0 max-phone:px-6">
          <h2 id={headingId} data-reveal className="max-w-[14ch]">{title}</h2>
          <p className="sub text-lead leading-[1.55] text-ink-2 max-w-[34ch] mt-5" data-reveal>{sub}</p>
          {form}
        </div>
      </div>
    </section>
  );
}
