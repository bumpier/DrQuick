import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/site/PageParts';
import { getDb } from '@/lib/db';
import { findByToken } from '@/lib/waitlist';
import { UnsubscribeConfirm } from './UnsubscribeConfirm';

// Reached from the link in every confirmation email. Never indexed, and a
// visit alone changes nothing (see UnsubscribeConfirm).
export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const raw = (await searchParams).token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const db = await getDb();
  if (!db) {
    return (
      <PageHero title="We can’t do that right now." lead="Please try the link again later, or get in touch and we will remove you by hand.">
        <Button asChild size="lg" variant="secondary"><Link href="/contact">Contact us</Link></Button>
      </PageHero>
    );
  }
  const signup = token ? await findByToken(db, token) : null;

  if (!signup || !token) {
    return (
      <PageHero
        title="This link has already been used."
        lead="Your details may already be deleted. If we still email you, get in touch and we will remove you by hand."
      >
        <Button asChild size="lg" variant="secondary"><Link href="/contact">Contact us</Link></Button>
      </PageHero>
    );
  }
  return <UnsubscribeConfirm token={token} role={signup.role} email={signup.email} />;
}
