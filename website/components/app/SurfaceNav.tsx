'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { activeNav } from '@/lib/shell';
import { DOCTOR_SECTION_OF, screenIdFor, type NavItem } from './nav';

// The product nav in the rail. Which item is lit comes from the pathname through
// the two functions the preview's shell used; the tooltip is the label the
// icon-only rail cannot show.
export function SurfaceNav({ items }: { items: NavItem[] }) {
  const current = activeNav(screenIdFor(usePathname()), DOCTOR_SECTION_OF);
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <nav aria-label="Sections">
          <SidebarMenu>
            {items.map(({ href, label, icon: Icon, screen }) => {
              const active = screen === current;
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={label}>
                    <Link href={href} aria-current={active ? 'page' : undefined} className="no-underline">
                      <Icon strokeWidth={2} />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
