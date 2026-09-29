import { ChevronRightIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { Badge } from '@/components/ui/badge';
import { fmtDuration } from '@/lib/admin/analytics-labels';
import { firstTouchChannel, fmtDateTime, fmtTime } from '@/lib/admin/format';
import { buildTimeline, type TimelineKind, type TimelineSessionInput } from '@/lib/admin/timeline';
import { cn } from '@/lib/utils';

/* A visitor's journey: every session, newest first, as a disclosure (the most
   recent one open). Inside, each page they viewed, and under it what they did
   there in sentences — sections read with their dwell, scroll milestones,
   clicks, calls to action, form steps and errors. Native <details>, so it
   works on the server with no script. Used on the visitor page and on both
   waitlist detail pages. */

const MARK: Record<TimelineKind, string> = {
  scroll: 'bg-outline',
  section: 'bg-primary-ink',
  click: 'bg-outline',
  cta: 'bg-ink',
  outbound: 'bg-ink',
  form: 'bg-ink',
  error: 'bg-ink',
  success: 'bg-primary-ink',
  other: 'bg-outline',
};

export function VisitorTimeline({ sessions, truncated = false, ownHost = null }: {
  sessions: TimelineSessionInput[];
  truncated?: boolean;
  ownHost?: string | null;
}) {
  const timeline = buildTimeline(sessions);
  if (timeline.length === 0) return <EmptyState>No visits recorded for this visitor.</EmptyState>;

  return (
    <ol data-slot="visitor-timeline" className="grid gap-3">
      {timeline.map((s, i) => (
        <li key={s.id}>
          <details open={i === 0} className="group rounded-xl bg-surface-mid">
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl px-4 py-3 hover:bg-fill-hover [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="font-semibold">
                  Visit {timeline.length - i} · {fmtDateTime(s.startedAt)}
                </span>
                <span className="block text-fine text-ink-2">
                  {[s.device, s.browser, s.os].filter(Boolean).join(' · ')}
                  {' · from '}{firstTouchChannel({ utmSource: s.utmSource, referrer: s.referrer }, ownHost)}
                </span>
              </span>
              <span className="flex items-center gap-2 text-fine text-ink-2">
                {s.converted && <Badge variant="success">Signed up</Badge>}
                <span className="tabular-nums">
                  {s.pageviews} {s.pageviews === 1 ? 'page' : 'pages'} · {fmtDuration(s.engagedSeconds)} active
                </span>
                <ChevronRightIcon strokeWidth={2} aria-hidden="true" className="size-4 text-primary-ink transition-transform duration-160 group-open:rotate-90" />
              </span>
            </summary>
            <div className="px-4 pb-4">
              {s.pages.length === 0 ? <p className="text-fine text-ink-2">No page events recorded.</p> : (
                <ol className="grid gap-3">
                  {s.pages.map((p) => (
                    <li key={p.key} className="rounded-lg bg-white px-4 py-3">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="min-w-0 font-semibold break-all">
                          <span className="font-mono text-fine">{p.path}</span>
                          {p.role && <span className="ml-2 text-fine font-normal text-ink-2">{p.role === 'gp' ? 'GP mode' : 'patient mode'}</span>}
                        </span>
                        <span className="text-fine text-ink-2 tabular-nums">
                          {fmtTime(p.ts)} · {fmtDuration(p.engagedSeconds)} active · {Math.round(p.maxScroll)}% scrolled
                        </span>
                      </p>
                      {p.items.length > 0 && (
                        <ol className="mt-2 grid gap-1">
                          {p.items.map((item) => (
                            <li key={item.key} className="grid grid-cols-[4.5rem_1fr] items-baseline gap-2 text-fine max-phone:grid-cols-[3.75rem_1fr]">
                              <span className="text-ink-2 tabular-nums">{fmtTime(item.ts)}</span>
                              <span className="flex min-w-0 items-baseline gap-2 break-words">
                                <span aria-hidden="true" className={cn('size-1.5 shrink-0 translate-y-[-1px] rounded-full', MARK[item.kind])} />
                                <span className={cn(item.kind === 'success' || item.kind === 'error' ? 'font-semibold' : undefined)}>{item.text}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </details>
        </li>
      ))}
      {truncated && <li className="text-fine text-ink-2">Older activity is not shown.</li>}
    </ol>
  );
}
