import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { guides } from "@/lib/guides";
import { getLiveTools, type ToolCategory } from "@/lib/data/tools";

// Priority tiers by category — flagship/high-search-volume tools (download,
// vocals) rank slightly above newer/narrower ones (cleanup, ai), but every
// live tool is included automatically. Add a tool to the registry and it
// shows up here with no sitemap edit required.
const CATEGORY_PRIORITY: Record<ToolCategory, number> = {
  download: 0.9,
  vocals: 0.9,
  convert: 0.8,
  "pitch-tempo": 0.8,
  cleanup: 0.7,
  ai: 0.7,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { path: "", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/tools", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.4, changeFrequency: "yearly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/dmca", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Every live tool, pulled from the registry — covers all 14 (and any
  // future additions) without listing each one by hand.
  const toolEntries: MetadataRoute.Sitemap = getLiveTools().map((tool) => ({
    url: `${SITE_URL}/${tool.slug}`,
    lastModified: new Date(),
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