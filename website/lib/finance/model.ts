// The finance pages' vocabulary and arithmetic, shared by the real (database)
// source and the demo generator so both produce exactly the same shapes. Pure.
//
// Every figure is attributed to the moment the money moved, in UTC:
//
//   Gross (GMV)     succeeded payments, by the time they were paid (paid_at)
//   Refunds         refunds, by the time they were made
//   GP fees         the GP fee of each COMPLETED consultation whose payment
//                   succeeded in the period (a cancelled or no-show
//                   consultation owes the GP nothing)
//   Net revenue     Gross − Refunds − GP fees: what Dr Quick keeps, before
//                   Stripe's own fees and every other cost
//   Take rate       Net revenue ÷ Gross
//   Avg price       Gross ÷ consultations paid for
//
// All money is integer pence in GBP.
import { CONSULTATION_STATUSES, PAYOUT_STATUSES } from '@/lib/db/schema';

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
export { CONSULTATION_STATUSES, PAYOUT_STATUSES };

export type Sums = {
  gmv: number;
  refunds: number;
  gpFees: number;
  paidConsults: number;   // consultations with a succeeded payment
  completed: number;      // of those, completed
};

export type Figures = Sums & {
  net: number;
  takeRate: number | null;   // null when nothing was taken
  avgPrice: number | null;
};

export const ZERO_SUMS: Sums = { gmv: 0, refunds: 0, gpFees: 0, paidConsults: 0, completed: 0 };

export function figures(s: Sums): Figures {
  const net = s.gmv - s.refunds - s.gpFees;
  return {
    ...s,
    net,
    takeRate: s.gmv > 0 ? net / s.gmv : null,
    avgPrice: s.paidConsults > 0 ? Math.round(s.gmv / s.paidConsults) : null,
  };
}

export function addSums(a: Sums, b: Sums): Sums {
  return {
    gmv: a.gmv + b.gmv,
    refunds: a.refunds + b.refunds,
    gpFees: a.gpFees + b.gpFees,
    paidConsults: a.paidConsults + b.paidConsults,
    completed: a.completed + b.completed,
  };
}

/* ------------------------------------------------------------- months */

export type Window = { from: Date; to: Date };

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// The calendar month `offset` months from the one holding `now`, [from, to).
export function monthWindow(now: Date, offset = 0): Window {
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1)),
  };
}

// The last `count` month keys, oldest first, ending with the month of `now`.
export function lastMonthKeys(now: Date, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => monthKey(monthWindow(now, i - count + 1).from));
}

// How far through its month `now` is, 0–1, for the run-rate estimate.
export function monthElapsed(now: Date): number {
  const { from, to } = monthWindow(now);
  return Math.min(1, Math.max(0, (now.getTime() - from.getTime()) / (to.getTime() - from.getTime())));
}

// This month's figures scaled to the whole month. An estimate: it assumes the
// rest of the month runs at the pace of the part already gone.
export function runRate(monthToDate: Sums, now: Date): Figures | null {
  const elapsed = monthElapsed(now);
  if (elapsed <= 0) return null;
  const k = 1 / elapsed;
  return figures({
    gmv: Math.round(monthToDate.gmv * k),
    refunds: Math.round(monthToDate.refunds * k),
    gpFees: Math.round(monthToDate.gpFees * k),
    paidConsults: Math.round(monthToDate.paidConsults * k),
    completed: Math.round(monthToDate.completed * k),
  });
}

/* ---------------------------------------------------------- the lists */

// Where a consultation's money stands, from its payment and any refunds.
export type PaymentState = 'none' | 'pending' | 'paid' | 'failed' | 'part_refunded' | 'refunded';

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  none: 'No payment',
  pending: 'Held',
  paid: 'Paid',
  failed: 'Failed',
  part_refunded: 'Part refunded',
  refunded: 'Refunded',
};

export function paymentState(status: string | null, amount: number, refunded: number): PaymentState {
  if (!status) return 'none';
  if (status === 'succeeded') {
    if (refunded >= amount && amount > 0) return 'refunded';
    return refunded > 0 ? 'part_refunded' : 'paid';
  }
  return status === 'failed' ? 'failed' : 'pending';
}

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  requested: 'Requested',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
};

export type ConsultationRow = {
  id: string;
  requestedAt: Date;
  status: ConsultationStatus;
  gpId: string | null;
  gpName: string | null;
  pricePence: number;
  gpFeePence: number;
  platformFeePence: number;
  payment: PaymentState;
  refundedPence: number;
};

export type PayoutRow = {
  id: string;
  gpId: string;
  gpName: string;
  periodStart: Date;
  periodEnd: Date;
  amountPence: number;
  status: PayoutStatus;
  paidAt: Date | null;
  consultations: number;
};

export type GpSummaryRow = {
  gpId: string;
  name: string;
  earnedThisMonth: number;   // GP fees attributed to this month (definition above)
  consultsThisMonth: number;
  pending: number;           // payouts pending or processing
  paidToDate: number;        // payouts paid
};

export type Page<T> = { rows: T[]; total: number; page: number; pages: number };

export const CONSULTATION_SORTS = ['requested', 'price', 'gp_fee', 'platform_fee', 'status'] as const;
export type ConsultationSort = (typeof CONSULTATION_SORTS)[number];
export const PAYMENT_STATES = Object.keys(PAYMENT_STATE_LABELS) as PaymentState[];

export type ConsultationQuery = {
  from: Date;
  to: Date;
  status?: ConsultationStatus;
  payment?: PaymentState;
  gp?: string;
  sort: ConsultationSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export const PAYOUT_SORTS = ['period', 'amount', 'paid', 'gp'] as const;
export type PayoutSort = (typeof PAYOUT_SORTS)[number];

export type PayoutQuery = {
  status?: PayoutStatus;
  gp?: string;
  sort: PayoutSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export type PayoutTotals = Record<PayoutStatus, { pence: number; count: number }>;

export const emptyPayoutTotals = (): PayoutTotals => ({
  pending: { pence: 0, count: 0 },
  processing: { pence: 0, count: 0 },
  paid: { pence: 0, count: 0 },
  failed: { pence: 0, count: 0 },
});

export const pagesFor = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));

// A page number that exists: past the end snaps back to the last page.
export const clampPage = (page: number, total: number, pageSize: number) => Math.min(Math.max(1, page), pagesFor(total, pageSize));

/* ---------------------------------------------------------- the source */

// One interface, two implementations: the database (lib/admin/queries/finance)
// and an in-memory dataset (the demo generator, and tests). Pages only ever
// talk to this, so a demo preview is the real page with other numbers.
export interface FinanceSource {
  readonly demo: boolean;
  sums(w: Window): Promise<Sums>;
  // Keyed by monthKey, for every month in [from, to) that has anything.
  monthlySums(w: Window): Promise<Map<string, Sums>>;
  consultations(q: ConsultationQuery): Promise<Page<ConsultationRow>>;
  statusMix(w: Window): Promise<Record<ConsultationStatus, number>>;
  gps(): Promise<Array<{ id: string; name: string }>>;
  payoutTotals(): Promise<PayoutTotals>;
  payouts(q: PayoutQuery): Promise<Page<PayoutRow>>;
  gpSummary(now: Date): Promise<GpSummaryRow[]>;
  payout(id: string): Promise<{ payout: PayoutRow; consultations: ConsultationRow[] } | null>;
}

export const emptyStatusMix = (): Record<ConsultationStatus, number> =>
  Object.fromEntries(CONSULTATION_STATUSES.map((s) => [s, 0])) as Record<ConsultationStatus, number>;
