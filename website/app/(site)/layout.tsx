import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IconDefs } from '@/components/IconDefs';
import { Footer } from '@/components/Footer';
import { SiteNav } from '@/components/site/SiteNav';
import { SiteReveal } from '@/components/site/SiteReveal';

// The marketing pages and the blog: one nav, one footer, one reveal grammar.
// The landing page keeps its own nav (it carries the Patients / GPs switch).
export const metadata: Metadata = {
  title: { default: 'Dr Quick', template: '%s · Dr Quick' },
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div data-site className="flex min-h-svh flex-col">
      <IconDefs />
      <a className="skip" href="#main">Skip to content</a>
      <SiteNav />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
      <SiteReveal />
    </div>
  );
}
