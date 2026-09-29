'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// A custom from–to span. Submitting navigates (the CSP forbids a native form
// submit), keeping the page's other parameters.
export function CustomRange({ basePath, keep, fromDay, toDay, active }: {
  basePath: string;
  keep: Record<string, string | undefined>;
  fromDay: string;
  toDay: string;
  active: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(fromDay);
  const [to, setTo] = useState(toDay);

  function apply(event: FormEvent) {
    event.preventDefault();
    if (!from || !to) return;
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
    q.set('from', from <= to ? from : to);
    q.set('to', from <= to ? to : from);
    router.push(`${basePath}?${q.toString()}`);
  }

  return (
    <details className="group relative">
      <summary
        className={cn(
          'inline-flex h-11 cursor-pointer list-none items-center rounded-pill px-4 text-fine font-semibold text-ink transition-colors duration-160 ease-(--ease) [&::-webkit-details-marker]:hidden',
          active ? 'bg-primary' : 'bg-fill hover:bg-fill-hover',
        )}
      >
        Custom
      </summary>
      <form
        onSubmit={apply}
        className="absolute left-0 z-20 mt-2 grid w-[min(20rem,calc(100vw-2rem))] gap-3 rounded-lg bg-white p-4 shadow-pop"
      >
        <label className="grid gap-1 text-fine font-semibold">
          From
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        <label className="grid gap-1 text-fine font-semibold">
          To
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <Button type="submit" size="sm">Show this range</Button>
      </form>
    </details>
  );
}
