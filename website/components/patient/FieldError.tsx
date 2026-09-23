import type { ReactNode } from 'react';
import { CircleAlertIcon } from 'lucide-react';

// What to fix, next to the field that needs it. The words are ink: error red
// on white fails AA at this size, so red is the icon and the field's border,
// the same split the landing page's form status uses.
export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" data-slot="field-error" className="flex items-start gap-2 text-fine font-semibold text-ink">
      <CircleAlertIcon strokeWidth={2} aria-hidden="true" className="mt-px size-4 shrink-0 text-error" />
      <span>{children}</span>
    </p>
  );
}
