// og:image and twitter:image must be absolute URLs on the production domain,
// or no crawler (Facebook, LinkedIn, Slack, WhatsApp, X) renders the share
// card. The flat page carried a loud placeholder; this build fails loudly
// instead — same intent, moved to build time.
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is not set. The share-card images must be absolute URLs on the production domain — set it before building for deploy.',
    );
  }
  return new URL('http://localhost:3000');
}
