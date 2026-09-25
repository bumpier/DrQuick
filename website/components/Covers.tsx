// The does/doesn't columns, as two bento tiles: "does" on white, "doesn't" on
// the quiet tone. Subgrid keeps the row hairlines level across both tiles.
// Ticks take primary-ink; the "doesn't" dashes stay secondary.
import type { CoversCol } from '@/app/landing-content';
import { Card } from '@/components/ui/card';

export function Covers({ headingId, title, cols }: {
  headingId: string; title: string; cols: [CoversCol, CoversCol];
}) {
  return (
    <section className="covers pt-section" aria-labelledby={headingId}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading max-w-[20ch]">{title}</h2>
        <div data-stagger
          className="grid grid-cols-2 grid-rows-[repeat(6,auto)] gap-4 max-cols:grid-cols-1 max-cols:grid-rows-none">
          {cols.map((col) => (
            <Card key={col.title} data-reveal variant={col.tone === 'yes' ? 'default' : 'quiet'}
              className="grid grid-rows-subgrid row-span-6 gap-0 px-8 py-7 max-cols:block max-phone:px-6">
              <h3 className="pb-4 border-b-2 border-rule">{col.title}</h3>
              <ul className="list-none grid grid-rows-subgrid row-span-5 max-cols:block">
                {col.items.map((item) => (
                  <li key={item}
                    className={`grid grid-cols-[20px_1fr] gap-3.5 py-4 border-b border-rule last:border-b-0 last:pb-0 text-body${col.tone === 'no' ? ' text-ink-2' : ''}`}>
                    <svg className={`mt-0.75 ${col.tone === 'yes' ? 'text-primary-ink' : 'text-ink-2'}`} width="20" height="20" aria-hidden="true">
                      <use href={col.tone === 'yes' ? '#i-yes' : '#i-no'} />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
