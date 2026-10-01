'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOutIcon, type LucideIcon } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/Wordmark';
import { activeNavHref } from './nav';

export type PortalNavItem = { href: string; label: string; icon: LucideIcon };
export type PortalNavGroup = { label: string | null; items: PortalNavItem[] };

// The rail of a signed-in area (the admin, the doctor portal): every section in
// its group, the current one a lime pill (DESIGN.md's "you are here"), and who
// is signed in at the foot. Below 900px the same content opens as a sheet from
// the top bar's trigger, and choosing a section closes it. The nav holds icon
// components, which cannot cross from a server component, so each area wraps
// this in a client component of its own that supplies them.
export function PortalSidebar({ home, homeLabel, navLabel, groups, name, email, signOut }: {
  home: string;
  homeLabel: string;
  navLabel: string;
  groups: PortalNavGroup[];
  name: string;
  email: string;
  signOut: () => Promise<void>;
}) {
  const current = activeNavHref(usePathname(), groups.flatMap((g) => g.items.map((item) => item.href)), home);
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link href={home} onClick={close} className="text-xl no-underline" aria-label={homeLabel}>
          <Wordmark />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={navLabel}>
          {groups.map((group, i) => (
            <SidebarGroup key={group.label ?? i} className="py-1">
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = href === current;
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          className="rounded-pill px-3 no-underline data-active:bg-primary data-active:text-ink data-active:hover:bg-primary-strong"
                        >
                          <Link href={href} onClick={close} aria-current={active ? 'page' : undefined}>
                            <Icon strokeWidth={2} />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-rule px-4 py-4">
        <div className="min-w-0">
          <p className="truncate text-fine font-semibold text-ink">{name}</p>
          <p className="truncate text-fine text-ink-2">{email}</p>
        </div>
        <form action={signOut} className="max-w-none">
          <Button type="submit" size="sm" variant="secondary" className="w-full">
            <LogOutIcon strokeWidth={2} />
            Sign out
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
