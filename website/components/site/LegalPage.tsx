// A legal document page: the hero, the draft banner, and the Markdown body in
// one white tile. Both legal pages are drafts until the legal entity exists
// (PRODUCT.md), so the banner is not optional here.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Prose } from '@/components/blog/Prose';
import { PageHero } from './PageParts';

export function LegalPage({ title, lead, updated, markdown }: {
  title: string; lead: string; updated: string; markdown: string;
}) {
  return (
    <>
      <PageHero title={title} lead={lead} />
      <div className="wrap pt-4 pb-section">
        <div data-reveal className="rounded-2xl bg-white shadow-card px-tile-lead-pad py-tile-lead-pad max-phone:px-6">
          <Alert variant="accent" data-slot="draft-alert" className="mb-10 max-w-[68ch] bg-lime-wash">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="10" cy="10" r="8" /><path d="M10 6v4.5M10 13.6v.1" />
            </svg>
            <AlertTitle>Draft — not yet in force</AlertTitle>
            <AlertDescription>
              This is a working draft for review before launch. Details in square brackets are still to be confirmed. Last updated {updated}.
            </AlertDescription>
          </Alert>
          <Prose markdown={markdown} />
        </div>
      </div>
    </>
  );
}
