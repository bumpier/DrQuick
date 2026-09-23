import type { Metadata } from 'next';
import { Prescriptions } from '@/components/patient/Prescriptions';

export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Prescriptions' };

export default function Page() {
  return <Prescriptions />;
}
