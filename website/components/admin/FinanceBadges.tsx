import { Badge } from '@/components/ui/badge';
import { fmtDate } from '@/lib/admin/format';
import {
  CONSULTATION_STATUS_LABELS, PAYMENT_STATE_LABELS, PAYOUT_STATUS_LABELS,
  type ConsultationStatus, type PaymentState, type PayoutRow, type PayoutStatus,
} from '@/lib/finance/model';

// Status chips for the finance tables. Only an outcome that needs a look
// carries a tone (a failure); the rest are neutral or the quiet success chip,
// and the word always says it, so colour is never the only signal.
export function PaymentBadge({ state }: { state: PaymentState }) {
  const variant = state === 'paid' ? 'success' : state === 'failed' ? 'destructive' : state === 'pending' ? 'default' : 'secondary';
  return <Badge variant={variant} data-payment={state}>{PAYMENT_STATE_LABELS[state]}</Badge>;
}

export function ConsultationBadge({ status }: { status: ConsultationStatus }) {
  const variant = status === 'completed' ? 'success' : status === 'in_progress' || status === 'requested' ? 'default' : 'secondary';
  return <Badge variant={variant} data-status={status}>{CONSULTATION_STATUS_LABELS[status]}</Badge>;
}

export function PayoutBadge({ status }: { status: PayoutStatus }) {
  const variant = status === 'paid' ? 'success' : status === 'failed' ? 'destructive' : status === 'processing' ? 'default' : 'secondary';
  return <Badge variant={variant} data-status={status}>{PAYOUT_STATUS_LABELS[status]}</Badge>;
}

// A payout's period is [start, end); the last day it covers is the day before end.
export const periodLabel = (p: Pick<PayoutRow, 'periodStart' | 'periodEnd'>) =>
  `${fmtDate(p.periodStart)} – ${fmtDate(new Date(p.periodEnd.getTime() - 86_400_000))}`;
