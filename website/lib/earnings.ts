/* Every earnings figure the doctor surface shows, derived once from the
   fixtures and from what this session produced, so the dashboard and the
   earnings screen can never disagree. Consults and money are two separate
   facts under dynamic pricing: a consultation pays what demand set at the
   moment it was accepted, so every total here is a sum of amounts and never a
   count multiplied by a rate. */
import { DOCTOR, DOCTOR_DASHBOARD as D, type RecentConsult } from '@/lib/fixtures';
import type { BarDatum } from '@/lib/charts';

export type SessionRecord = RecentConsult & { isNew: true };
export type Earnings = {
  todayConsults: number; weekConsults: number; fortnightConsults: number; toDateConsults: number;
  today: number; week: number; fortnight: number; toDate: number; payoutAmount: number;
  recent: Array<RecentConsult | SessionRecord>;
  dailySeries: BarDatum[];
  busiest: { label: string; consults: number } | null;
};

export function earningsFor({ seeded, session }: { seeded: boolean; session: SessionRecord[] }): Earnings {
  const days = D.dailyConsults.map((d) => (seeded ? { ...d } : { ...d, consults: 0, earnings: 0 }));
  const today = days[days.length - 1];
  today.consults += session.length;
  today.earnings += session.reduce((n, r) => n + r.fee, 0);
  const sum = (list: { consults: number }[]) => list.reduce((n, d) => n + d.consults, 0);
  const paid = (list: { earnings: number }[]) => list.reduce((n, d) => n + d.earnings, 0);
  const todayConsults = today.consults;
  const weekConsults = sum(days.slice(-7));
  const fortnightConsults = sum(days);
  const toDateConsults = (seeded ? DOCTOR.consultsCompleted : 0) + session.length;
  const toDate = (seeded ? DOCTOR.earningsToDate : 0) + session.reduce((n, r) => n + r.fee, 0);
  const busiest = fortnightConsults === 0 ? null : days.reduce((b, d) => (d.consults > b.consults ? d : b));
  return {
    todayConsults, weekConsults, fortnightConsults, toDateConsults,
    today: today.earnings, week: paid(days.slice(-7)), fortnight: paid(days),
    toDate, payoutAmount: paid(days.slice(-7)),
    recent: [...session, ...(seeded ? D.recent : [])],
    dailySeries: days.map((d, i) => ({ label: d.label, value: d.consults, emph: i === days.length - 1 ? 'true' : 'false' })),
    busiest,
  };
}
