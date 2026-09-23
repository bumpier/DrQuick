import type { AnchorHTMLAttributes, ReactNode } from 'react';

// next/link reads the App Router's context, which a unit test does not mount.
// A test that renders patient screens registers this in its place:
//   vi.mock('next/link', () => import('./helpers/next-link'));
// A plain anchor keeps the href, the aria attributes and the text, which is
// everything the tests assert; navigation is the router mock's job.
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean };

export default function Link({ href, children, prefetch: _prefetch, ...rest }: Props) {
  return <a href={href} {...rest}>{children}</a>;
}
