'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withQuery, type Query } from '@/lib/admin/url';

export type FilterDef = { name: string; label: string; options: Array<{ value: string; label: string }> };

const ALL = '__all';

// Search and filters for a list, written into the URL. Any change goes back
// to page one. Submitting navigates, since the CSP forbids a native submit.
export function ListToolbar({ basePath, query, filters, placeholder }: {
  basePath: string;
  query: Query;
  filters: FilterDef[];
  placeholder: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query.q ?? '');
  const filtered = Boolean(query.q) || filters.some((f) => query[f.name]);

  function search(event: FormEvent) {
    event.preventDefault();
    router.push(withQuery(basePath, query, { q: q.trim() || null, page: null }));
  }

  return (
    <div data-slot="list-toolbar" className="mb-4 flex flex-wrap items-end gap-3">
      <form role="search" onSubmit={search} className="flex min-w-0 flex-1 basis-72 items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <SearchIcon strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-2" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-10" />
        </label>
        <Button type="submit" variant="secondary" size="sm">Search</Button>
      </form>
      {filters.map((f) => (
        <label key={f.name} className="grid gap-1 text-fine font-semibold text-ink-2">
          {f.label}
          <Select
            value={query[f.name] ?? ALL}
            onValueChange={(v) => router.push(withQuery(basePath, query, { [f.name]: v === ALL ? null : v, page: null }))}
          >
            <SelectTrigger className="min-w-40" aria-label={f.label}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      ))}
      {filtered && (
        <Link
          href={withQuery(basePath, query, { q: null, page: null, ...Object.fromEntries(filters.map((f) => [f.name, null])) })}
          className="inline-flex h-12 items-center text-fine font-semibold text-primary-ink"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
