import type { Metadata } from 'next';
import { Consultations } from '@/components/patient/Consultations';

export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Consultations' };

export default function Page() {
  return <Consultations />;
}
