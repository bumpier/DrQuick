// Native disclosure; all styling and the open/close transition live in the
// authored layer.
export type FaqItem = { q: string; a: React.ReactNode };

export function Faq({ headingId, title, items }: {
  headingId: string; title: string; items: FaqItem[];
}) {
  return (
    <section className="faq border-t border-rule pt-section-tight pb-section" aria-labelledby={headingId}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading-tight max-w-[16ch]">{title}</h2>
        <div data-stagger>
          {items.map((item) => (
            <details data-reveal key={item.q}>
              <summary>{item.q}</summary>
              {item.a}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
