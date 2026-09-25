'use client';
// The page links, shared by the landing nav, the site nav and the phone menu.
// The current page (or its section, for a blog post) is the lime pill — the
// same "you are here" mark as the segmented switch.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from '@/lib/site';
import { cn } from '@/lib/utils';

export function NavLinks({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  const pathname = usePathname() ?? '/';
  return (
    <ul className={cn('flex list-none', stacked ? 'flex-col gap-1' : 'items-center gap-1', className)}>
      {NAV_LINKS.map(({ href, label }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'inline-flex items-center rounded-pill font-semibold text-ink-2 no-underline whitespace-nowrap',
                'transition-[background-color,color] duration-160 ease-(--ease) hover:bg-surface-mid hover:text-ink',
                'aria-[current=page]:bg-primary aria-[current=page]:text-ink',
                stacked ? 'h-12 w-full px-4 text-lead' : 'h-10 px-4 text-label',
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
