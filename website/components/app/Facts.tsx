import type { ReactNode } from 'react';

// Label and value, two columns, one fact per row on a hairline. A screen may
// state exactly the rows it passes in and nothing else — the offer's three
// permitted facts are three rows — so the list is the audit trail of what was
// shown. Values arrive formatted through shown() or live().
export function Facts({ items }: { items: ReadonlyArray<readonly [label: string, value: ReactNode]> }) {
  return (
    <dl data-slot="facts" className="text-body">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[16ch_1fr] gap-x-4 border-b border-rule py-3 max-phone:grid-cols-1 max-phone:gap-y-1"
        >
          <dt className="text-ink-2">{label}</dt>
          <dd className="min-w-0 font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
