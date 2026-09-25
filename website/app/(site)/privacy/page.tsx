import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/LegalPage';
import { PRIVACY_MD, PRIVACY_UPDATED } from './content';

export const dynamic = 'force-static';

// A draft must not be indexed as if it were in force: noindex here and as a
// header in next.config.ts, until the legal placeholders are filled in.
export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Dr Quick handles the details you give us on this website.',
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy."
      lead="What we collect on this website, why, and how long we keep it. The short version: an email address, and nothing about your health."
      updated={PRIVACY_UPDATED}
      markdown={PRIVACY_MD}
    />
  );
}
