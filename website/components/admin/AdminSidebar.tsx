'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/Wordmark';
import { signOut } from '@/app/admin/actions';
import { ADMIN_NAV, activeHref } from './nav';

// The admin's rail: every section in its group, the current one a lime pill
// (DESIGN.md's "you are here"), and who is signed in at the foot. Below 900px
// the same content opens as a sheet from the top bar's trigger, and choosing a
// section closes it.
export function AdminSidebar({ name, email }: { name: string; email: string }) {
  const current = activeHref(usePathname());
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link href="/admin" onClick={close} className="text-xl no-underline" aria-label="Dr Quick admin, overview">
          <Wordmark />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Admin">
          {ADMIN_NAV.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
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
