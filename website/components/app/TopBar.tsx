import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { DOCTOR, DOCTOR_DASHBOARD } from '@/lib/fixtures';
import type { NavItem } from './nav';
import { Wordmark } from '@/components/Wordmark';

type Props = { surface: 'doctor' | 'admin'; title: string; nav: NavItem[]; end?: React.ReactNode };

// The product's top bar: the trigger, the wordmark home, the surface's name, the
// one control the surface owns (availability or the data mode), and who is signed
// in — a fixture ref, never a name.
export function TopBar({ surface, title, nav, end }: Props) {
  const who = surface === 'doctor'
    ? { initials: DOCTOR_DASHBOARD.initials, name: DOCTOR.ref }
    : { initials: 'AD', name: 'Admin' };
  return (
    <header
      data-slot="top-bar"
      className="sticky top-(--ribbon-h) z-10 flex h-16 items-center gap-4 border-b border-rule bg-white px-6 max-phone:px-4"
    >
      <SidebarTrigger />
      <Link href="/" className="text-xl no-underline">
        <Wordmark />
      </Link>
      <span className="text-fine text-ink-2">{title}</span>
      {/* useIsMobile() is false on the server: below 900 the desktop rail is `hidden`
          and the Sheet never mounts without JavaScript, so scripts-off at 390 needs
          real links. md:hidden keeps it from doubling the server-rendered rail at 1440. */}
      <noscript>
        <nav aria-label="Sections" className="md:hidden">
          <ul className="flex flex-wrap gap-3 text-fine">
            {nav.map((item) => <li key={item.href}><a href={item.href}>{item.label}</a></li>)}
          </ul>
        </nav>
      </noscript>
      <div className="ml-auto flex items-center gap-3">
        {end}
        <Avatar size="sm"><AvatarFallback>{who.initials}</AvatarFallback></Avatar>
        <span className="text-fine font-semibold max-phone:sr-only">{who.name}</span>
      </div>
    </header>
  );
}
