import { Badge } from '@/components/ui/badge';
import { feeStatusLabel, statusLabel } from '@/lib/admin/format';

// A sign-up's status as a chip. Only the ends of the pipeline carry a tone:
// active and subscribed are the success chip; everything else is neutral, so
// the colour never has to be decoded.
export function StatusBadge({ role, status }: { role: string; status: string }) {
  const variant = status === 'active' || status === 'subscribed' ? 'success' : status === 'new' ? 'default' : 'secondary';
  return <Badge variant={variant} data-status={status}>{statusLabel(role, status)}</Badge>;
}

// The GP sign-up fee as a chip, on the same rule: paid is the success chip and
// everything else is neutral, with the words carrying the difference.
export function FeeBadge({ status }: { status: string | null }) {
  return <Badge variant={status === 'paid' ? 'success' : 'secondary'} data-fee={status ?? 'none'}>{feeStatusLabel(status)}</Badge>;
}
