// lib/data/tools.ts
//
// Single source of truth for every tool on the site.
// Navbar dropdown, /tools hub page, and each page's "More free tools"
// cross-link section all pull from this file — add a tool here once,
// it shows up everywhere correctly and consistently.
//
// NOTE ON HQ TIERS: Studio Quality separation (/separate-hq, /stems-hq)
// is NOT a separate entry here — it's an in-page toggle on the existing
// "vocal-remover" and "stems" pages (see VocalRemoverForm's hqAvailable
// prop). One URL per underlying tool concept, not two near-duplicate
// pages competing for the same search intent.
//
// NOTE ON "browser" CATEGORY: these tools (recorder, metronome, BPM
// tapper, tuner) run ENTIRELY client-side via Web Audio / MediaRecorder -
// no upload, no backend call, no job polling. Grouped separately from
// "convert"/"cleanup"/etc. rather than mixed in, since "no server
// round-trip at all" is a genuinely different category of tool, not
// just a different function within the same category.
//
// NOTE ON CATEGORY NAMING (2026-08-10): categories describe what the
// USER wants to do, never how a tool is implemented under the hood.
// "AI Tools" was renamed to "transcription" for exactly this reason: it
// was the one category named after its technology rather than its
// intent, it held only speech-to-text, and its existence implied every
// OTHER tool wasn't AI-powered - untrue, since vocal-remover/stems also
// run on an ML separation model. "Transcription" names what the user is
// actually trying to do. If more AI-flavored tools are added later that
// aren't transcription (a voice changer, a lyrics generator), that's the
// signal to reconsider the taxonomy again then - not a reason to keep a
// technology-named bucket around now on the chance it might fit later.
//
// NOTE ON "Echo Remover" (2026-08-12): renamed from "Echo Reducer" to
// match the actual page (title/H1/schema/breadcrumb) after keyword data
// showed "echo remover" carries real, Easy-difficulty search volume while
// "echo reducer" carries essentially none. This is category naming (like
// "vocal remover"), not a claim of 100% removal — the page body copy still
// accurately says "reduces mild echo," only the product name changed.

export type ToolCategory =
  | "download"
  | "convert"
  | "pitch-tempo"
  | "cleanup"
  | "vocals"
  | "transcription"
  | "browser";

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
  transcription: "Transcription",
  browser: "Browser Tools",
};

export const CATEGORY_ORDER: ToolCategory[] = [
  "download",
  "vocals",
  "convert",
  "pitch-tempo",
  "cleanup",
  "transcription",
  "browser",
];

export const TOOLS: Tool[] = [
  // ---------- DOWNLOAD ----------
  {
    slug: "youtube-to-wav",
    name: "YouTube to WAV",
    shortDescription: "Convert YouTube videos to WAV or MP3 audio.",
    category: "download",
    status: "live",
    related: ["key-finder", "vocal-remover"],
  },
  {
    slug: "youtube-key-finder",
    name: "YouTube Key & BPM Finder",
    shortDescription: "Paste a YouTube link and get its key, BPM, and Camelot code directly.",
    category: "download",
    status: "live",
    related: ["key-finder", "youtube-to-wav", "youtube-vocal-remover"],
  },
  {
    slug: "youtube-vocal-remover",
    name: "YouTube Vocal Remover",
    shortDescription: "Paste a YouTube link and get vocal and instrumental stems directly.",
    category: "download",
    status: "live",
    related: ["vocal-remover", "youtube-to-wav", "youtube-key-finder"],
  },
  {
    slug: "youtube-stem-splitter",
    name: "YouTube Stem Splitter",
    shortDescription: "Paste a YouTube link and get vocals, drums, bass, and other stems directly.",
    category: "download",
    status: "live",
    related: ["stems", "youtube-to-wav", "youtube-vocal-remover"],
  },

  // ---------- VOCALS & KEY ----------
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
    related: ["stems", "key-finder", "youtube-to-wav"],
  },
  {
    slug: "stems",
    name: "Stem Splitter",
    shortDescription: "Split a track into vocals, drums, bass, and other stems.",
    category: "vocals",
    status: "live",
    related: ["vocal-remover", "key-finder", "youtube-stem-splitter"],
  },

  // ---------- CONVERT & EDIT ----------
  {
    slug: "convert",
    name: "Audio Converter",
    shortDescription: "Convert between MP3, WAV, FLAC, M4A, AAC, OGG, AIFF.",
    category: "convert",
    status: "live",
    related: ["trim", "volume"],
  },
  {
    slug: "video-to-audio",
    name: "Video to Audio Converter",
    shortDescription: "Extract audio from MP4, MOV, and other video files.",
    category: "convert",
    status: "live",
    related: ["convert", "youtube-to-wav"],
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
    name: "Volume Booster",
    shortDescription: "Boost or reduce audio gain in decibels.",
    category: "convert",
    status: "live",
    related: ["trim", "convert"],
  },
  {
    slug: "loudness-normalizer",
    name: "Loudness Normalizer",
    shortDescription: "Normalize a track to streaming, club, or broadcast loudness (LUFS).",
    category: "convert",
    status: "live",
    related: ["volume", "convert"],
  },
  {
    slug: "audio-joiner",
    name: "Audio Joiner",
    shortDescription: "Combine multiple audio files into a single track.",
    category: "convert",
    status: "live",
    related: ["trim", "convert"],
  },
  {
    slug: "fade",
    name: "Fade In/Out",
    shortDescription: "Add a smooth fade in and fade out to a track.",
    category: "convert",
    status: "live",
    related: ["trim", "volume"],
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
    slug: "mono-stereo-converter",
    name: "Mono/Stereo Converter",
    shortDescription: "Convert audio between mono and stereo channels.",
    category: "convert",
    status: "live",
    related: ["sample-rate-converter", "convert"],
  },
  {
    slug: "sample-rate-converter",
    name: "Sample Rate Converter",
    shortDescription: "Change an audio file's sample rate and bit depth.",
    category: "convert",
    status: "live",
    related: ["mono-stereo-converter", "convert"],
  },
  {
    slug: "ringtone-maker",
    name: "Ringtone Maker",
    shortDescription: "Trim a track into an iPhone-ready ringtone (M4R).",
    category: "convert",
    status: "live",
    related: ["trim", "convert"],
  },

  // ---------- PITCH & TEMPO ----------
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

  // ---------- CLEANUP & ENHANCE ----------
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
    shortDescription: "Reduce mild echo and slap-back in a recording.",
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
    related: ["silence-split", "voice-clean", "noise-remove"],
  },
  {
    slug: "silence-split",
    name: "Silence Splitter",
    shortDescription: "Split one long recording into separate tracks at silent gaps.",
    category: "cleanup",
    status: "live",
    related: ["silence-remove", "trim"],
  },

  // ---------- TRANSCRIPTION ----------
  {
    slug: "speech-to-text",
    name: "Speech to Text",
    shortDescription: "Transcribe audio with timestamps, powered by Whisper.",
    category: "transcription",
    status: "live",
    related: ["voice-clean", "silence-remove"],
  },

  // ---------- BROWSER TOOLS ----------
  {
    slug: "voice-recorder",
    name: "Online Voice Recorder",
    shortDescription: "Record audio from your microphone and download it — runs entirely in your browser.",
    category: "browser",
    status: "live",
    related: ["convert", "trim"],
  },
  {
    slug: "metronome",
    name: "Online Metronome",
    shortDescription: "Adjustable BPM metronome with time signature support, right in your browser.",
    category: "browser",
    status: "live",
    related: ["bpm-tapper", "key-finder"],
  },
  {
    slug: "bpm-tapper",
    name: "BPM Tapper",
    shortDescription: "Tap along to a beat and find its tempo instantly.",
    category: "browser",
    status: "live",
    related: ["metronome", "key-finder"],
  },
  {
    slug: "tuner",
    name: "Online Tuner",
    shortDescription: "Tune any instrument in real time using your microphone.",
    category: "browser",
    status: "live",
    related: ["metronome", "key-finder"],
  },
  {
    slug: "audio-to-midi",
    name: "Audio to MIDI Converter",
    shortDescription: "Transcribe a melody or vocal line into a downloadable MIDI file.",
    category: "transcription",
    status: "live",
    related: ["speech-to-text", "key-finder", "vocal-remover"],
  },
  {
    slug: "tiktok-to-mp3",
    name: "TikTok to MP3",
    shortDescription: "Convert a TikTok video link into a downloadable MP3.",
    category: "download",
    status: "live",
    related: ["trim", "ringtone-maker", "youtube-to-wav"],
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