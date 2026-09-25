import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/LegalPage';
import { TERMS_MD, TERMS_UPDATED } from './content';

export const dynamic = 'force-static';

// A draft must not be indexed as if it were in force: noindex here and as a
// header in next.config.ts, until the legal placeholders are filled in.
export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms for using the Dr Quick website.',
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms."
      lead="The rules for using this website. Separate terms will cover consultations when Dr Quick opens."
      updated={TERMS_UPDATED}
      markdown={TERMS_MD}
    />
  );
}
