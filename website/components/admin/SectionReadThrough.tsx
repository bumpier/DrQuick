import { sectionLabel, fmtDuration } from '@/lib/admin/analytics-labels';
import { fmtCount, fmtPct } from '@/lib/admin/format';
import type { SectionRow } from '@/lib/admin/queries/engagement';

/* How much of the page people read: the landing sections in reading order,
   each bar as long as the share of views that read it (≥500ms on screen),
   primary-ink on the fill track. Between two bars, the drop-off in words;
   the largest drop is called out so the eye lands on where people leave.
   Average dwell sits on the right. Plain HTML: it renders on the server and
   every figure is printed, so nothing depends on reading a bar's length. */
export function SectionReadThrough({ sections, total }: { sections: SectionRow[]; total: number }) {
  const worst = sections.reduce<number | null>((w, s, i) =>
    s.dropOff !== null && s.dropOff > 0 && (w === null || s.dropOff > (sections[w].dropOff ?? 0)) ? i : w, null);
  return (
    <ol data-slot="section-read-through" aria-label={`Share of ${fmtCount(total)} views that read each section, in page order`} className="grid">
      {sections.map((s, i) => (
        <li key={s.section} className="grid">
          {i > 0 && (
            <p className="flex items-center gap-2 py-1.5 pl-3 text-fine text-ink-2">
              <span aria-hidden="true" className="h-4 w-px bg-rule" />
              {s.dropOff === null || s.dropOff === 0 ? 'No drop-off' : (
                <span className={i === worst ? 'font-semibold text-ink' : undefined}>
                  {fmtPct(s.dropOff)} stopped before this section{i === worst ? ' — the biggest drop' : ''}
                </span>
              )}
            </p>
          )}
          <div className="grid grid-cols-[minmax(0,11rem)_1fr_5.5rem] items-center gap-3 max-phone:grid-cols-[1fr_auto]">
            <span className="min-w-0 truncate font-semibold">{i + 1}. {sectionLabel(s.section)}</span>
            <div className="h-7 rounded-sm bg-fill max-phone:order-last max-phone:col-span-2" title={`${sectionLabel(s.section)}: ${fmtPct(s.share)}`}>
              <div className="flex h-full items-center rounded-sm bg-primary-ink" style={{ width: `${Math.max(s.views > 0 ? 1 : 0, s.share * 100)}%` }} />
            </div>
            <span className="text-right text-fine">
              <strong className="block text-body font-bold tabular-nums">{fmtPct(s.share)}</strong>
              <span className="text-ink-2 tabular-nums">{s.avgDwellMs === null ? 'not read' : `${fmtDuration(s.avgDwellMs / 1000)} avg`}</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
