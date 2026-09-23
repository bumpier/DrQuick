import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS } from '@/lib/alerts';
import type { CredentialStatus } from '@/lib/fixtures';
import { DASH } from '@/lib/placeholder';
import { cn } from '@/lib/utils';

// Status is an ink ramp, not a primary accent (decision 23): pending sits on the
// fill in ink-2, expiring steps up to ink on a 15% ink fill, and Verified, Expired
// and Rejected are the only places success and error appear on the surfaces.
// Blank mode has no status and says so. Inside a band-filled row every badge is
// white at 15% — error on the band fails AA at 12px once the badge's own fill
// lightens the ground — so the row is the severity and the badge carries the word.
const VARIANT = {
  pending: 'secondary',
  expiring: 'secondary',
  valid: 'success',
  expired: 'destructive',
  rejected: 'destructive',
} as const satisfies Record<CredentialStatus, 'secondary' | 'success' | 'destructive'>;

type Props = { status: CredentialStatus | null; onBand?: boolean; className?: string };

export function StatusBadge({ status, onBand = false, className }: Props) {
  const tone = cn(status === 'expiring' && 'bg-ink/15 text-ink', onBand && 'bg-white/15 text-white', className);
  if (status === null) {
    return <Badge variant="secondary" aria-label="Not submitted" className={tone}>{DASH}</Badge>;
  }
  return <Badge variant={VARIANT[status]} data-status={status} className={tone}>{STATUS_LABELS[status]}</Badge>;
}
