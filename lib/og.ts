import { getToolBySlug } from "@/lib/data/tools";
import type { Guide } from "@/lib/guides";

/** Bump when the card design changes — the route sets a one-year immutable
 *  cache, so without a new URL the CDN keeps serving the old image. */
const OG_VERSION = "1";

export function ogImage(title: string, subtitle?: string, badge?: string) {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set("subtitle", subtitle);
  if (badge) params.set("badge", badge);
  params.set("v", OG_VERSION);
  return {
    url: `/api/og?${params.toString()}`,
    width: 1200,
    height: 630,
    alt: title,
  };
}

/**
 * Card for a tool page, built from the registry so the subtitle can't drift
 * from the tool's own description.
 *
 * Override `title` on most pages: the registry holds the catalogue name
 * ("Audio Trimmer") while the page reads and ranks as "Free Audio Trimmer".
 */
export function ogForTool(slug: string, title?: string) {
  const tool = getToolBySlug(slug);
  return ogImage(title ?? tool?.name ?? "AudioForges", tool?.shortDescription);
}

/** Card for a guide. The badge says "Guide" rather than "Free · No sign-up"
 *  — the tool framing is wrong on an article. */
export function ogForGuide(guide: Pick<Guide, "title" | "description">) {
  return ogImage(guide.title, guide.description, "Guide");
}