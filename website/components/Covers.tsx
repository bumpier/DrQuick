// The does/doesn't columns. Subgrid keeps the row hairlines level across both
// columns, exactly as the flat page's CSS did. Ticks take the primary; the
// "doesn't" dashes stay secondary.
import type { CoversCol } from '@/app/landing-content';

export function Covers({ headingId, title, cols }: {
  headingId: string; title: string; cols: [CoversCol, CoversCol];
}) {
  return (
    <section className="covers border-t border-rule py-section" aria-labelledby={headingId}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading max-w-[20ch]">{title}</h2>
        <div data-stagger
          className="grid grid-cols-2 grid-rows-[repeat(6,auto)] gap-x-covers-gap gap-y-0 max-cols:grid-cols-1 max-cols:grid-rows-none max-cols:gap-covers-gap-col">
          {cols.map((col) => (
            <div key={col.title} data-reveal className="grid grid-rows-subgrid row-span-6 max-cols:block">
              <h3 className="pb-4 border-b-2 border-rule">{col.title}</h3>
              <ul className="list-none grid grid-rows-subgrid row-span-5 max-cols:block">
                {col.items.map((item) => (
                  <li key={item}
                    className={`grid grid-cols-[20px_1fr] gap-3.5 py-4 border-b border-rule text-body${col.tone === 'no' ? ' text-ink-2' : ''}`}>
                    <svg className={`mt-0.75 ${col.tone === 'yes' ? 'text-primary' : 'text-ink-2'}`} width="20" height="20" aria-hidden="true">
                      <use href={col.tone === 'yes' ? '#i-yes' : '#i-no'} />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
