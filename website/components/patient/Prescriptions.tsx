'use client';

import { EmptyState } from '@/components/app/EmptyState';
import { PageHeader } from '@/components/app/PageHeader';
import { Timeline } from '@/components/app/Timeline';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { money } from '@/lib/format';
import { isCollected, type PrescriptionRow } from '@/lib/patient';
import { PAGE } from './page';
import { usePatient } from './PatientProvider';

function titleFor(rx: PrescriptionRow): string {
  if (isCollected(rx)) return 'Collected';
  return rx.pharmacy ? 'With your pharmacy' : 'Waiting to be sent';
}

// Where each prescription actually is, step by step. The pharmacy charge is
// named on every one, against the price that consultation actually cost:
// the consultation covers writing a prescription, never the medicine.
export function Prescriptions() {
  const { prescriptions, history } = usePatient();
  return (
    <div data-screen="prescriptions" className={PAGE}>
      <PageHeader
        title="Prescriptions"
        lead="The consultation price covered writing the prescription. The pharmacy charges you separately for the medicine itself."
      />
      {prescriptions.length === 0 ? (
        <EmptyState>No prescriptions yet. Any a GP writes for you will appear here.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" data-stagger>
          {prescriptions.map((rx) => {
            const consultation = history.find((row) => row.id === rx.consultation);
            return (
              <li key={rx.id} data-reveal>
                <Card data-slot="prescription" data-rx={rx.id} className="h-full">
                  <CardHeader>
                    <CardTitle role="heading" aria-level={2}>{titleFor(rx)}</CardTitle>
                    <CardDescription>{rx.pharmacy ?? 'No pharmacy saved yet'}</CardDescription>
                    <CardAction><span className="text-fine text-ink-2 whitespace-nowrap">{rx.issued}</span></CardAction>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <Timeline label={`Prescription ${rx.id}`} steps={rx.steps} />
                    {consultation && consultation.cost > 0 && (
                      <p className="text-fine text-ink-2">
                        {`Your ${money(consultation.cost)} covered the consultation and writing this prescription. The pharmacy charges you separately for the medicine.`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
