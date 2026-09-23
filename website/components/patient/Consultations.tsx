'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/app/EmptyState';
import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFigures } from '@/lib/data-mode';
import { money } from '@/lib/format';
import { ConsultRow } from './ConsultRow';
import { PAGE } from './page';
import { usePatient } from './PatientProvider';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

// The history, Uber's Activity. The year's figures count what this patient
// has actually done, so a consultation finished in this session shows up at
// once; money is summed from what each one cost, never a count times a rate,
// and zero is a dash.
export function Consultations() {
  const { history } = usePatient();
  const { live } = useFigures();
  const [filter, setFilter] = useState<Filter>('all');

  const rows = history.filter((row) => filter === 'all' || row.status === filter);
  const completed = history.filter((row) => row.status === 'completed');
  const paid = completed.reduce((sum, row) => sum + row.cost, 0);
  const shared = completed.filter((row) => row.outcome?.sharedWithNhsGp).length;

  return (
    <div data-screen="consultations" className={PAGE}>
      <PageHeader title="Consultations" />
      <Card className="mb-8" data-reveal>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>This year</CardTitle>
          <CardDescription>The pharmacy charges separately for any medicine.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 max-phone:grid-cols-1">
          <StatTile size="sm" value={live(completed.length)} label="Consultations" />
          <StatTile size="sm" value={live(paid, money)} label="Paid to Dr Quick" />
          <StatTile size="sm" value={live(shared)} label="Summaries sent to your NHS GP" />
        </CardContent>
      </Card>
      <div role="group" aria-label="Filter consultations" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'default' : 'secondary'}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {history.length === 0 ? (
        <EmptyState>No consultations yet. Your first one will appear here.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>No consultations match that filter.</EmptyState>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y divide-rule">
              {rows.map((row) => <li key={row.id}><ConsultRow consultation={row} /></li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
