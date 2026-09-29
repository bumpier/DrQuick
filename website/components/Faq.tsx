// Native disclosure, inside one white bento tile: the heading holds the left
// column and the questions the right. All styling and the open/close
// transition of the questions live in the authored layer.
export type FaqItem = { q: string; a: React.ReactNode };

export function Faq({ headingId, section, title, items }: {
  headingId: string; section?: string; title: string; items: FaqItem[];
}) {
  return (
    <section className="faq pt-section" aria-labelledby={headingId} data-section={section}>
      <div className="wrap">
        <div className="rounded-2xl bg-white shadow-card px-tile-lead-pad py-tile-lead-pad grid grid-cols-[.8fr_1.2fr] gap-x-16 gap-y-heading-tight max-cols:grid-cols-1 max-phone:px-6">
          <h2 id={headingId} data-reveal className="max-w-[12ch]">{title}</h2>
          <div data-stagger>
            {items.map((item) => (
              <details data-reveal key={item.q}>
                <summary>{item.q}</summary>
                {item.a}
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
