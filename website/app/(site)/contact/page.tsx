import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHero, SiteSection } from '@/components/site/PageParts';
import { CONTACT_EMAIL, mailto } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions about the waitlist, joining as a GP, press and partnerships.',
};

// No contact form: the site collects nothing beyond an email address (CLAUDE.md),
// and a free-text box invites symptoms. Enquiries go by email, and anyone who is
// unwell is pointed to 999 and 111 before anything else.
const ENQUIRIES = [
  { title: 'Patients and the waitlist', body: 'Questions about Dr Quick, or asking us to delete your waitlist details.', subject: 'Waitlist enquiry', tone: 'wash' as const },
  { title: 'GPs', body: 'Working with Dr Quick, the checks, and what a consultation pays.', subject: 'GP enquiry', tone: 'sage' as const },
  { title: 'Press and partnerships', body: 'Media, pharmacies and organisations who want to work with us.', subject: 'Press or partnership enquiry', tone: 'stone' as const },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Get in touch."
        lead="We haven’t launched yet, so this is the place for questions about the waitlist, joining as a GP, press and partnerships."
      />

      <div className="wrap pt-4">
        <Card variant="band" data-reveal="load" className="band-grid grid grid-cols-[1fr_auto] items-center gap-6 px-tile-lead-pad py-10 max-cols:grid-cols-1 max-phone:px-6">
          <div>
            <h2 className="text-title-lead leading-[1.15]">Unwell right now?</h2>
            <p className="text-body text-band-muted mt-3 max-w-[52ch]">
              This inbox is not monitored for medical questions. In an emergency, call 999 or go to A&amp;E. If you’re not sure what to do, call NHS 111.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-ink hover:bg-surface-mid"><a href="tel:999">Call 999</a></Button>
            <Button asChild size="lg"><a href="tel:111">Call 111</a></Button>
          </div>
        </Card>
      </div>

      <SiteSection title="Email us.">
        <div className="grid grid-cols-3 gap-4 max-cols:grid-cols-1" data-stagger>
          {ENQUIRIES.map((e) => (
            <Card key={e.title} variant={e.tone} data-reveal className="tile justify-between gap-8 p-7">
              <div>
                <h3>{e.title}</h3>
                <p className="text-body text-ink-2 mt-2.5">{e.body}</p>
              </div>
              <Button asChild variant="dark" className="self-start"><a href={mailto(e.subject)}>Email us</a></Button>
            </Card>
          ))}
        </div>
        <p data-reveal className="text-body text-ink-2 mt-6">
          Or write to <a className="font-semibold text-primary-ink underline underline-offset-4 decoration-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </SiteSection>
      <div className="pb-section" />
    </>
  );
}
