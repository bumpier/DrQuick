import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/Wordmark';
import { requireAdmin } from '@/lib/admin-auth';
import { signOut } from '../actions';

// Every signed-in admin page: the session is checked here, and again in every
// server action, since a layout does not re-render on every action.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-rule bg-white">
        <div className="flex h-16 items-center gap-6 px-6 max-phone:gap-3 max-phone:px-4">
          <Link href="/admin/blog" className="text-xl no-underline" aria-label="Dr Quick admin, home"><Wordmark /></Link>
          <nav aria-label="Admin">
            <Link href="/admin/blog" className="inline-flex h-10 items-center rounded-pill bg-primary px-4 text-label font-semibold text-ink no-underline">Blog</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-fine font-semibold text-ink-2 max-phone:sr-only">{admin.name}</span>
            <form action={signOut} className="max-w-none">
              <Button type="submit" size="sm" variant="secondary">Sign out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-10 max-phone:px-4">{children}</main>
    </>
  );
}
