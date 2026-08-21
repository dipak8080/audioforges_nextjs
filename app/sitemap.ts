import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { guides } from "@/lib/guides";
import { getLiveTools, type ToolCategory } from "@/lib/data/tools";

// Priority tiers by category — flagship/high-search-volume tools (download,
// vocals) rank slightly above newer/narrower ones (cleanup, transcription),
// but every live tool is included automatically. Add a tool to the registry
// and it shows up here with no sitemap edit required.
const CATEGORY_PRIORITY: Record<ToolCategory, number> = {
  download: 0.9,
  vocals: 0.9,
  convert: 0.8,
  "pitch-tempo": 0.8,
  cleanup: 0.7,
  transcription: 0.7,
  browser: 0.7,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { path: "", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/tools", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides", priority: 0.8, changeFrequency: "weekly" as const },
    // NOT IN `TOOLS`, SO IT HAS TO BE LISTED BY HAND.
    //
    // /free-transcription-no-sign-up is editorial, not a tool — it has no
    // form and no backend endpoint, so it was never going to appear in a
    // TOOLS-driven sitemap. It was missing entirely until now.
    //
    // Priority 0.8 rather than a tool's 0.7: it's the wedge page the three
    // transcription tools all link into, and the one most likely to earn a
    // link on its own merits.
    {
      path: "/free-transcription-no-sign-up",
      priority: 0.8,
      changeFrequency: "monthly" as const,
    },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.4, changeFrequency: "yearly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/dmca", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  /**
   * lastModified is the BUILD DATE, not a content date, and that is a
   * deliberate compromise rather than an oversight.
   *
   * `new Date()` means every page in this sitemap claims to have changed
   * on every deploy — including /privacy, which hasn't changed in months.
   * A crawler that checks and finds nothing different learns to discount
   * the signal, which is exactly the freshness signal the transcription
   * pages are trying to earn with their "last verified" footers.
   *
   * The guide entries below already do this properly, using each guide's
   * own updatedDate. The right fix is the same thing for tools and static
   * routes: a `lastModified` field on the Tool interface and on each
   * static route, set by hand when the page's content actually changes.
   *
   * TODO(dipak): do that. It's a small change and it makes the freshness
   * claim true rather than mechanical.
   */
  const buildDate = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: buildDate,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Every live tool, pulled from the registry — covers all of them (and any
  // future additions) without listing each one by hand.
  const toolEntries: MetadataRoute.Sitemap = getLiveTools().map((tool) => ({
    url: `${SITE_URL}/${tool.slug}`,
    lastModified: buildDate,
    changeFrequency: "weekly" as const,
    priority: CATEGORY_PRIORITY[tool.category],
  }));

  const guideEntries: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    lastModified: new Date(guide.updatedDate),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...toolEntries, ...guideEntries];
}