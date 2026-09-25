'use client';
// The phone menu: the page links in a sheet from the right. Only below 900px,
// and never the only way through — the footer carries every link, so the
// pages stay reachable without JavaScript.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NavLinks } from './NavLinks';

export function SiteMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // A tapped link navigates; the sheet closes behind it.
  useEffect(() => { setOpen(false); }, [pathname]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon-sm" className={className} aria-label="Menu">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-6 pt-16">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <nav aria-label="Pages"><NavLinks stacked /></nav>
        <Button asChild size="lg" className="mt-4 w-full">
          <a href="/#join">Join the waitlist</a>
        </Button>
      </SheetContent>
    </Sheet>
  );
}
