import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Shown on a list after an erasure redirects back to it.
export function ErasedNotice() {
  return (
    <Alert className="mb-4" role="status">
      <AlertTitle>Person erased</AlertTitle>
      <AlertDescription>
        Their sign-ups, email history and any linked visit history have been deleted. The audit log keeps only that it happened.
      </AlertDescription>
    </Alert>
  );
}
