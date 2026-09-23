import { notFound } from 'next/navigation';
import { Gallery } from './gallery';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Dr Quick — component gallery',
  robots: { index: false, follow: false },
};

// Development only: every component in components/ui in every variant and
// state, on the ground, on white and on the band — the screenshot target for
// parity checks and for dashboard work. A production build renders it as a
// 404, and /dev/* carries the noindex header from next.config.ts as a second
// lock. It never ships.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Gallery />;
}
