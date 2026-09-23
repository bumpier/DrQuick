import type { Metadata } from 'next';
import { Account } from '@/components/patient/Account';

export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Account' };

export default function Page() {
  return <Account />;
}
