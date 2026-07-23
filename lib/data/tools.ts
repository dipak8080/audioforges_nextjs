// lib/data/tools.ts
//
// Single source of truth for every tool on the site.
// Navbar dropdown, /tools hub page, and each page's "More free tools"
// cross-link section all pull from this file — add a tool here once,
// it shows up everywhere correctly and consistently.

export type ToolCategory =
  | "download"
  | "convert"
  | "pitch-tempo"
  | "cleanup"
  | "vocals"
  | "ai";

export type ToolStatus = "live" | "coming-soon";

export interface Tool {
  slug: string; // route is `/${slug}`
  name: string;
  shortDescription: string; // used in nav dropdown, hub cards, cross-links
  category: ToolCategory;
  status: ToolStatus;
  /** Explicit curated related tool slugs, in priority order. Overrides generic
   * same-category matching — use this when the genuinely useful next step
   * isn't just "another tool in the same bucket" (e.g. speech-to-text should
   * point to voice-clean, not just any AI-category tool). */
  related?: string[];
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  download: "Download",
  convert: "Convert & Edit",
  "pitch-tempo": "Pitch & Tempo",
  cleanup: "Cleanup & Enhance",
  vocals: "Vocals & Key",
  ai: "AI Tools",
};

export const CATEGORY_ORDER: ToolCategory[] = [
  "download",
  "vocals",
  "convert",
  "pitch-tempo",
  "cleanup",
  "ai",
];

export const TOOLS: Tool[] = [
  {
    slug: "youtube-to-wav",
    name: "YouTube to WAV",
    shortDescription: "Convert YouTube videos to WAV or MP3 audio.",
    category: "download",
    status: "live",
    related: ["key-finder", "vocal-remover"],
  },
  {
    slug: "key-finder",
    name: "Key & BPM Finder",
    shortDescription: "Detect musical key, tempo, and Camelot notation.",
    category: "vocals",
    status: "live",
    related: ["youtube-to-wav", "vocal-remover"],
  },
  {
    slug: "vocal-remover",
    name: "Vocal Remover",
    shortDescription: "Split a track into vocal and instrumental stems.",
    category: "vocals",
    status: "live",
    related: ["key-finder", "youtube-to-wav"],
  },
  {
    slug: "convert",
    name: "Audio Converter",
    shortDescription: "Convert between MP3, WAV, FLAC, M4A, AAC, OGG, AIFF.",
    category: "convert",
    status: "live",
    related: ["trim", "volume"],
  },
  {
    slug: "trim",
    name: "Trim Audio",
    shortDescription: "Cut audio to a specific start and end point.",
    category: "convert",
    status: "live",
    related: ["convert", "volume"],
  },
  {
    slug: "volume",
    name: "Volume Adjuster",
    shortDescription: "Boost or reduce audio gain in decibels.",
    category: "convert",
    status: "live",
    related: ["trim", "convert"],
  },
  {
    slug: "reverse",
    name: "Reverse Audio",
    shortDescription: "Flip a track to play backwards.",
    category: "convert",
    status: "live",
    related: ["pitch", "tempo"],
  },
  {
    slug: "pitch",
    name: "Pitch Shifter",
    shortDescription: "Change pitch independently of tempo.",
    category: "pitch-tempo",
    status: "live",
    related: ["tempo", "reverse"],
  },
  {
    slug: "tempo",
    name: "Tempo Changer",
    shortDescription: "Speed up or slow down without affecting pitch.",
    category: "pitch-tempo",
    status: "live",
    related: ["pitch", "reverse"],
  },
  {
    slug: "noise-remove",
    name: "Noise Remover",
    shortDescription: "Reduce background noise with adjustable strength.",
    category: "cleanup",
    status: "live",
    related: ["voice-clean", "silence-remove"],
  },
  {
    slug: "voice-clean",
    name: "Voice Cleaner",
    shortDescription: "Speech-optimized cleanup: denoise, rumble cut, normalize.",
    category: "cleanup",
    status: "live",
    related: ["noise-remove", "echo-remove"],
  },
  {
    slug: "echo-remove",
    name: "Echo Remover",
    shortDescription: "Suppress echo and reverb tails from a recording.",
    category: "cleanup",
    status: "live",
    related: ["voice-clean", "noise-remove"],
  },
  {
    slug: "silence-remove",
    name: "Silence Remover",
    shortDescription: "Strip silent gaps throughout a track, not just the ends.",
    category: "cleanup",
    status: "live",
    related: ["voice-clean", "noise-remove"],
  },
  {
    slug: "speech-to-text",
    name: "Speech to Text",
    shortDescription: "Transcribe audio with timestamps, powered by Whisper.",
    category: "ai",
    status: "live",
    related: ["voice-clean", "silence-remove"],
  },
];

export function getLiveTools(): Tool[] {
  return TOOLS.filter((t) => t.status === "live");
}

export function getToolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

// Returns related live tools for "More free tools" cross-link sections.
// Priority: 1) explicit curated `related` list (only live entries, in order),
// 2) other tools in the same category, 3) anything else live. This ensures
// every page links to genuinely relevant tools rather than always showing
// the same first-N-in-list-order pair.
export function getRelatedTools(currentSlug: string, count: number = 2): Tool[] {
  const current = getToolBySlug(currentSlug);
  const liveExcludingSelf = getLiveTools().filter((t) => t.slug !== currentSlug);

  if (!current) return liveExcludingSelf.slice(0, count);

  const result: Tool[] = [];
  const usedSlugs = new Set<string>();

  if (current.related) {
    for (const slug of current.related) {
      const tool = liveExcludingSelf.find((t) => t.slug === slug);
      if (tool && !usedSlugs.has(tool.slug)) {
        result.push(tool);
        usedSlugs.add(tool.slug);
      }
      if (result.length >= count) break;
    }
  }

  if (result.length < count) {
    const sameCategory = liveExcludingSelf.filter(
      (t) => t.category === current.category && !usedSlugs.has(t.slug)
    );
    for (const tool of sameCategory) {
      result.push(tool);
      usedSlugs.add(tool.slug);
      if (result.length >= count) break;
    }
  }

  if (result.length < count) {
    const others = liveExcludingSelf.filter((t) => !usedSlugs.has(t.slug));
    for (const tool of others) {
      result.push(tool);
      usedSlugs.add(tool.slug);
      if (result.length >= count) break;
    }
  }

  return result;
}