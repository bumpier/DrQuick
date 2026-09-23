import type { Metadata } from 'next';
import { ConsultationDetail } from '@/components/patient/ConsultationDetail';
import { CONSULTATIONS } from '@/lib/fixtures';

export const dynamic = 'force-static';
// True, and a test pins it: a consultation this session created (C-0001 in
// blank mode, C-0032 seeded) has no build-time page, and `false` would answer
// the link to it with a 404. Unlisted ids render on demand and show the
// placeholder until the provider supplies the record. This is also why the
// site cannot move to `output: 'export'`.
export const dynamicParams = true;

export const metadata: Metadata = { title: 'Consultation' };

export function generateStaticParams(): Array<{ id: string }> {
  return CONSULTATIONS.map((consultation) => ({ id: consultation.id }));
}

// `params` is unused: the id is read from usePathname() in the client
// component, the same source every other patient screen reads.
export default function Page(_props: { params: Promise<{ id: string }> }) {
  return <ConsultationDetail />;
}
