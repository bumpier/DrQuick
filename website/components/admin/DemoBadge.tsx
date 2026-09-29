import { Badge } from '@/components/ui/badge';

// Marks any figure drawn from the demo generator rather than the database, so
// a preview can never be mistaken for real money or real people.
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" data-slot="demo-badge" className={className} title="Demo data, not real figures">
      Demo data
    </Badge>
  );
}
