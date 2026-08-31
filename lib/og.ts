/** Builds the OG image entry for a page's metadata. Relative on purpose —
 *  metadataBase in app/layout.tsx resolves it. */
export function ogImage(title: string, subtitle?: string, badge?: string) {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set("subtitle", subtitle);
  if (badge) params.set("badge", badge);
  return {
    url: `/api/og?${params.toString()}`,
    width: 1200,
    height: 630,
    alt: title,
  };
}