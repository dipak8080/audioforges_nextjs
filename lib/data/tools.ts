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
//
// NOTE ON FULL `related` COVERAGE (2026-08-23): every entry below now
// lists exactly FIVE slugs, because five is the largest `count` any page
// passes to getRelatedTools. Previously most entries listed two or three
// and the remaining slots were filled by the same-category fallback in
// declaration order. That fallback is not neutral: it silently decided a
// large share of the site's internal link graph, it favoured whichever
// tools happened to sit earliest in this array, and it never reached
// anything declared near the bottom of the file.
//
// The concrete failure it caused: `tiktok-to-mp3` sat last in the array
// under a "DOWNLOAD (cont.)" header and appeared in ZERO other entry's
// `related` list. youtube-to-wav — by a wide margin the site's strongest
// page in search — listed two slugs and had its other three slots filled
// by the download-category fallback, which walked the array in order,
// found youtube-key-finder / youtube-vocal-remover / youtube-stem-splitter,
// hit the count, and stopped before ever reaching tiktok-to-mp3. On a
// site whose external link profile is close to nonexistent, internal
// links are the main authority signal we actually control, and the
// newest page was receiving none of it.
//
// Two invariants worth preserving when editing this file:
//   1. Every entry lists five slugs. If a tool genuinely has fewer than
//      five useful neighbours, that is a signal the tool is isolated,
//      not a reason to let the fallback choose for you.
//   2. Every live slug appears in at least two OTHER entries' `related`
//      arrays. Grep before you delete a slug from a list — a tool that
//      falls to zero inbound cross-links becomes an orphan reachable
//      only from the navbar and /tools hub.
//
// NOTE ON ORDERING (2026-08-23): `tiktok-to-mp3` moved up into the
// DOWNLOAD block where it belongs. The old "DOWNLOAD (cont.)" section at
// the bottom was an append-and-forget artifact. Declaration order is not
// cosmetic here — the category fallback iterates this array in order, so
// anything parked at the bottom is structurally last in line for every
// fallback decision on the site.

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
   * isn't just "another tool in the same bucket" (e.g. audio-to-text should
   * point to voice-clean, not just any transcription-category tool).
   *
   * LIST EXACTLY FIVE. Five is the largest `count` any page passes (the tool
   * pages — verified against the rendered HTML of /key-finder, which shows
   * five cards). Anything short of five hands the remaining slots to the
   * same-category fallback, which picks by declaration order rather than by
   * relevance and is where irrelevant cross-links come from. */
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
    // The site's strongest search page, so its five outbound links carry
    // more weight than any other entry here. tiktok-to-mp3 is placed third
    // deliberately: same "paste a link, get audio" intent, and it was
    // previously receiving no internal links at all.
    related: ["key-finder", "vocal-remover", "tiktok-to-mp3", "video-to-audio", "trim"],
  },
  {
    slug: "youtube-key-finder",
    name: "YouTube Key & BPM Finder",
    shortDescription: "Paste a YouTube link and get its key, BPM, and Camelot code directly.",
    category: "download",
    status: "live",
    related: ["key-finder", "youtube-to-wav", "youtube-vocal-remover", "bpm-tapper", "tempo"],
  },
  {
    slug: "youtube-vocal-remover",
    name: "YouTube Vocal Remover",
    shortDescription: "Paste a YouTube link and get vocal and instrumental stems directly.",
    category: "download",
    status: "live",
    related: ["vocal-remover", "youtube-to-wav", "youtube-stem-splitter", "youtube-key-finder", "stems"],
  },
  {
    slug: "youtube-stem-splitter",
    name: "YouTube Stem Splitter",
    shortDescription: "Paste a YouTube link and get vocals, drums, bass, and other stems directly.",
    category: "download",
    status: "live",
    // audio-to-midi in the fifth slot is a real workflow, not filler:
    // isolate a stem, then transcribe that stem to MIDI.
    related: ["stems", "youtube-vocal-remover", "youtube-to-wav", "key-finder", "audio-to-midi"],
  },
  {
    slug: "tiktok-to-mp3",
    name: "TikTok to MP3",
    shortDescription: "Convert a TikTok video link into a downloadable MP3.",
    category: "download",
    status: "live",
    // Matches what the page copy actually tells people to do next: trim the
    // clip, fade the cut so it doesn't click, or send it to the ringtone
    // maker for the 30s cap and M4R container.
    related: ["trim", "ringtone-maker", "fade", "youtube-to-wav", "convert"],
  },

  // ---------- VOCALS & KEY ----------
  {
    slug: "key-finder",
    name: "Key & BPM Finder",
    shortDescription: "Detect musical key, tempo, and Camelot notation.",
    category: "vocals",
    status: "live",
    related: ["bpm-tapper", "youtube-key-finder", "vocal-remover", "tempo", "audio-to-midi"],
  },
  {
    slug: "vocal-remover",
    name: "Vocal Remover",
    shortDescription: "Split a track into vocal and instrumental stems.",
    category: "vocals",
    status: "live",
    related: ["stems", "key-finder", "youtube-vocal-remover", "audio-to-midi", "youtube-to-wav"],
  },
  {
    slug: "stems",
    name: "Stem Splitter",
    shortDescription: "Split a track into vocals, drums, bass, and other stems.",
    category: "vocals",
    status: "live",
    related: ["vocal-remover", "key-finder", "youtube-stem-splitter", "audio-to-midi", "tempo"],
  },

  // ---------- CONVERT & EDIT ----------
  {
    slug: "convert",
    name: "Audio Converter",
    shortDescription: "Convert between MP3, WAV, FLAC, M4A, AAC, OGG, AIFF.",
    category: "convert",
    status: "live",
    related: ["trim", "volume", "sample-rate-converter", "mono-stereo-converter", "video-to-audio"],
  },
  {
    slug: "video-to-audio",
    name: "Video to Audio Converter",
    shortDescription: "Extract audio from MP4, MOV, and other video files.",
    category: "convert",
    status: "live",
    // video-to-text is the other thing people arrive here wanting; several
    // land on this page when what they actually need is the transcript.
    related: ["convert", "youtube-to-wav", "tiktok-to-mp3", "video-to-text", "trim"],
  },
  {
    slug: "trim",
    name: "Trim Audio",
    shortDescription: "Cut audio to a specific start and end point.",
    category: "convert",
    status: "live",
    related: ["convert", "fade", "volume", "ringtone-maker", "audio-joiner"],
  },
  {
    slug: "volume",
    name: "Volume Booster",
    shortDescription: "Boost or reduce audio gain in decibels.",
    category: "convert",
    status: "live",
    // loudness-normalizer first: "my track is too quiet" is usually a
    // loudness-target problem, not a gain problem, and this is the page
    // where that misconception gets corrected.
    related: ["loudness-normalizer", "trim", "convert", "noise-remove", "fade"],
  },
  {
    slug: "loudness-normalizer",
    name: "Loudness Normalizer",
    shortDescription: "Normalize a track to streaming, club, or broadcast loudness (LUFS).",
    category: "convert",
    status: "live",
    related: ["volume", "convert", "sample-rate-converter", "trim", "key-finder"],
  },
  {
    slug: "audio-joiner",
    name: "Audio Joiner",
    shortDescription: "Combine multiple audio files into a single track.",
    category: "convert",
    status: "live",
    related: ["trim", "fade", "convert", "silence-split", "volume"],
  },
  {
    slug: "fade",
    name: "Fade In/Out",
    shortDescription: "Add a smooth fade in and fade out to a track.",
    category: "convert",
    status: "live",
    related: ["trim", "volume", "audio-joiner", "convert", "ringtone-maker"],
  },
  {
    slug: "reverse",
    name: "Reverse Audio",
    shortDescription: "Flip a track to play backwards.",
    category: "convert",
    status: "live",
    related: ["pitch", "tempo", "trim", "convert", "fade"],
  },
  {
    slug: "mono-stereo-converter",
    name: "Mono/Stereo Converter",
    shortDescription: "Convert audio between mono and stereo channels.",
    category: "convert",
    status: "live",
    related: ["sample-rate-converter", "convert", "volume", "loudness-normalizer", "trim"],
  },
  {
    slug: "sample-rate-converter",
    name: "Sample Rate Converter",
    shortDescription: "Change an audio file's sample rate and bit depth.",
    category: "convert",
    status: "live",
    related: ["mono-stereo-converter", "convert", "loudness-normalizer", "volume", "trim"],
  },
  {
    slug: "ringtone-maker",
    name: "Ringtone Maker",
    shortDescription: "Trim a track into an iPhone-ready ringtone (M4R).",
    category: "convert",
    status: "live",
    // tiktok-to-mp3 second: making a ringtone out of a TikTok sound is a
    // real and common path, and /guides/tiktok-sound-to-ringtone already
    // documents it, so the connection is topical rather than manufactured.
    related: ["trim", "tiktok-to-mp3", "fade", "youtube-to-wav", "convert"],
  },

  // ---------- PITCH & TEMPO ----------
  {
    slug: "pitch",
    name: "Pitch Shifter",
    shortDescription: "Change pitch independently of tempo.",
    category: "pitch-tempo",
    status: "live",
    related: ["tempo", "key-finder", "reverse", "tuner", "convert"],
  },
  {
    slug: "tempo",
    name: "Tempo Changer",
    shortDescription: "Speed up or slow down without affecting pitch.",
    category: "pitch-tempo",
    status: "live",
    related: ["bpm-tapper", "pitch", "key-finder", "metronome", "reverse"],
  },

  // ---------- CLEANUP & ENHANCE ----------
  //
  // Each cleanup entry ends with audio-to-text. That is not padding: the
  // cleanup tools are overwhelmingly used on speech recordings, and a
  // cleaned-up recording is the input a transcript wants. It also gives
  // the transcription cluster five inbound internal links it did not
  // previously have, which matters while those URLs are still fighting to
  // get indexed at all.
  {
    slug: "noise-remove",
    name: "Noise Remover",
    shortDescription: "Reduce background noise with adjustable strength.",
    category: "cleanup",
    status: "live",
    related: ["voice-clean", "silence-remove", "echo-remove", "volume", "audio-to-text"],
  },
  {
    slug: "voice-clean",
    name: "Voice Cleaner",
    shortDescription: "Speech-optimized cleanup: denoise, rumble cut, normalize.",
    category: "cleanup",
    status: "live",
    related: ["noise-remove", "echo-remove", "silence-remove", "audio-to-text", "volume"],
  },
  {
    slug: "echo-remove",
    name: "Echo Remover",
    shortDescription: "Reduce mild echo and slap-back in a recording.",
    category: "cleanup",
    status: "live",
    related: ["voice-clean", "noise-remove", "silence-remove", "volume", "audio-to-text"],
  },
  {
    slug: "silence-remove",
    name: "Silence Remover",
    shortDescription: "Strip silent gaps throughout a track, not just the ends.",
    category: "cleanup",
    status: "live",
    related: ["silence-split", "voice-clean", "noise-remove", "trim", "audio-to-text"],
  },
  {
    slug: "silence-split",
    name: "Silence Splitter",
    shortDescription: "Split one long recording into separate tracks at silent gaps.",
    category: "cleanup",
    status: "live",
    related: ["silence-remove", "trim", "voice-clean", "audio-joiner", "audio-to-text"],
  },

  // ---------- TRANSCRIPTION ----------
  {
    slug: "audio-to-text",
    name: "Audio to Text",
    shortDescription: "Transcribe audio to text with timestamps, free and without an account.",
    category: "transcription",
    status: "live",
    // voice-clean and silence-split are the two the page copy actually
    // recommends: clean the recording first, split it if it's over the
    // duration cap. noise-remove replaces youtube-to-wav in the fifth slot
    // — it's the other cleanup step people need before a usable transcript,
    // and youtube-to-wav already has ample inbound links elsewhere.
    related: ["youtube-to-text", "video-to-text", "voice-clean", "silence-split", "noise-remove"],
  },
  {
    slug: "youtube-to-text",
    name: "YouTube to Text",
    shortDescription: "Paste a YouTube link and get the full transcript, free.",
    category: "transcription",
    status: "live",
    // youtube-to-wav and silence-split are steps 1 and 2 of the
    // over-the-limit workaround the page documents.
    related: ["audio-to-text", "video-to-text", "youtube-to-wav", "silence-split", "video-to-audio"],
  },
  {
    slug: "video-to-text",
    name: "Video to Text",
    shortDescription: "Upload a video and get a transcript or subtitle file.",
    category: "transcription",
    status: "live",
    // video-to-audio is what the page tells people to use when a file is
    // over the byte cap.
    related: ["audio-to-text", "youtube-to-text", "video-to-audio", "voice-clean", "silence-split"],
  },

  // ---------- AUDIO TO MIDI ----------
  //
  // MOVED HERE (2026-08-21) from under "// BROWSER TOOLS", where it sat
  // while declaring category: "transcription". The comment headers are
  // decoration — the category field is what the code reads — so nothing
  // was broken, but a reader scanning for the transcription tools would
  // have missed it, which is the whole point of grouping the file.
  //
  // `related` pointed at "speech-to-text", a route that no longer exists
  // (it 308s to /audio-to-text). getRelatedTools silently skips slugs it
  // can't resolve, so the entry didn't error — it just quietly returned
  // one fewer tool than asked for and let the category fallback pick the
  // replacement.
  //
  // The replacements are musical, not speech: someone converting a melody
  // to MIDI wants the key, the isolated stem, the source audio, or a way
  // to check the tempo — they do not want a speech transcript.
  //
  // OPEN QUESTION worth deciding: is category "transcription" right at
  // all? It's literally transcription, but nobody browsing a
  // "Transcription" menu for a speech transcript wants MIDI, and grouping
  // them means each keeps showing up in the other's category listings.
  // "vocals" is arguably the better home. Left as-is for now because
  // changing it also changes the nav dropdown and the /tools hub.
  //
  // Worth noting the 2026-08-23 `related` pass reduces the urgency of that
  // question: with every entry listing five slugs, the category fallback
  // no longer fires anywhere, so audio-to-midi can no longer be pulled
  // into a speech page's cross-links (or vice versa) purely by sharing a
  // category label. The remaining cost of the current category is confined
  // to the navbar dropdown and the /tools hub grouping.
  {
    slug: "audio-to-midi",
    name: "Audio to MIDI Converter",
    shortDescription: "Transcribe a melody or vocal line into a downloadable MIDI file.",
    category: "transcription",
    status: "live",
    related: ["key-finder", "vocal-remover", "stems", "tempo", "youtube-to-wav"],
  },

  // ---------- BROWSER TOOLS ----------
  {
    slug: "voice-recorder",
    name: "Online Voice Recorder",
    shortDescription: "Record audio from your microphone and download it — runs entirely in your browser.",
    category: "browser",
    status: "live",
    // A recording made here almost always needs cleaning next, which is
    // why two cleanup tools sit above the other browser tools.
    related: ["convert", "trim", "noise-remove", "voice-clean", "tuner"],
  },
  {
    slug: "metronome",
    name: "Online Metronome",
    shortDescription: "Adjustable BPM metronome with time signature support, right in your browser.",
    category: "browser",
    status: "live",
    related: ["bpm-tapper", "tempo", "tuner", "key-finder", "voice-recorder"],
  },
  {
    slug: "bpm-tapper",
    name: "BPM Tapper",
    shortDescription: "Tap along to a beat and find its tempo instantly.",
    category: "browser",
    status: "live",
    related: ["metronome", "key-finder", "tempo", "tuner", "youtube-key-finder"],
  },
  {
    slug: "tuner",
    name: "Online Tuner",
    shortDescription: "Tune any instrument in real time using your microphone.",
    category: "browser",
    status: "live",
    related: ["metronome", "bpm-tapper", "key-finder", "voice-recorder", "pitch"],
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
//
// NOTE: an unresolvable slug in `related` (a renamed or deleted route) is
// skipped silently rather than throwing. That's deliberate — a stale
// cross-link should not break a page render — but it means a typo shows up
// only as a slightly-off related list, which is easy to miss. If a page's
// related tools ever look arbitrary, check its `related` array for a slug
// that no longer exists before looking anywhere else.
//
// As of 2026-08-23 every entry lists five slugs and every page passes a
// count of five or fewer, so branches 2 and 3 below should never execute.
// They are kept as a safety net for a future tool added with a short list,
// not as part of normal operation. If you find yourself explaining an
// unexpected cross-link, the first thing to check is whether the source
// entry has fewer than five resolvable slugs — that is the only way these
// branches can fire.
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