'use client';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withQuery, type Query } from '@/lib/admin/url';

const ALL = '__all';

// One URL parameter as a select (the page picker, a segment filter). Choosing
// navigates, keeping the page's other parameters. `allLabel` adds an option
// that clears the parameter.
export function QuerySelect({ label, name, value, options, basePath, query, allLabel, clear = [] }: {
  label: string;
  name: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  basePath: string;
  query: Query;
  allLabel?: string;
  clear?: string[];   // parameters that stop making sense when this one changes
}) {
  const router = useRouter();
  return (
    <label className="grid gap-1 text-fine font-semibold text-ink-2">
      {label}
      <Select
        value={value ?? ALL}
        onValueChange={(v) => router.push(withQuery(basePath, query, {
          [name]: v === ALL ? null : v,
          ...Object.fromEntries(clear.map((k) => [k, null])),
        }), { scroll: false })}
      >
        <SelectTrigger className="min-w-44 max-w-full" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}
