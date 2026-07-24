export interface Guide {
  slug: string;
  title: string;
  description: string;
  publishedDate: string; // ISO format
  updatedDate: string;   // ISO format
}

export const guides: Guide[] = [
  {
    slug: "camelot-wheel-harmonic-mixing",
    title: "The Camelot Wheel Explained: Harmonic Mixing for DJs",
    description:
      "How the Camelot Wheel works, why harmonic mixing makes sets flow, and how to use key compatibility when building a set.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-21",
  },
  {
    slug: "wav-vs-mp3-for-sampling",
    title: "WAV vs MP3 for Sampling: What Actually Changes",
    description:
      "The real technical differences between WAV and MP3 for sampling, layering, and production — and when the difference actually matters.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-24",
  },
  {
    slug: "dj-set-prep-checklist",
    title: "DJ Set Prep Checklist: 6 Steps to a Set That Flows",
    description:
      "A 6-step DJ set prep workflow: gather tracks, tag key and BPM, group by Camelot compatibility, and order for energy — before you play.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-24",
  },
  {
    slug: "finding-reference-tracks",
    title: "How to Find Reference Tracks That Actually Help",
    description:
      "How to pick reference tracks for a specific purpose, match their role to your mix, and get them into a usable local format for A/B comparison.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-24",
  },
  {
    slug: "lossless-vs-lossy-audio-formats",
    title: "Lossless vs Lossy Audio: Which Format to Use",
    description:
      "The real difference between lossless and lossy audio — and why converting MP3 to WAV won't recover quality you've already lost.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "how-to-trim-audio-without-losing-quality",
    title: "How to Trim Audio Without Losing Quality",
    description:
      "Why trimming a lossless file is bit-perfect but a lossy file depends on cut placement, and how to avoid a click at your trim point.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "gain-staging-for-home-studios",
    title: "Gain Staging Explained for Home Studios",
    description:
      "How decibels work, why clipping happens at the top of the range, and where to set gain before other processing so nothing distorts downstream.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "pitch-shifting-vs-key-changing",
    title: "Pitch Shifting Explained: Semitones & Musical Keys",
    description:
      "Why shifting pitch by semitones is different from just speeding up or slowing down a track, and how to pick a comfortable vocal range without changing tempo.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "dj-tempo-matching-without-pitch-shift",
    title: "How to Match Tempo Without Changing Pitch",
    description:
      "Why nudging a track's speed for a mashup or DJ set doesn't have to shift its key, and how much tempo change you can get away with before it sounds off.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "reversed-audio-in-music-production",
    title: "Reversed Audio: Creative Uses in Production",
    description:
      "How reversed cymbals, vocal chops, and risers are actually built, plus the backmasking curiosity that made reversed audio famous in the first place.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "removing-background-noise-from-recordings",
    title: "How to Remove Background Noise from Audio",
    description:
      "How FFT-based noise reduction actually works, why pushing the strength too high causes warbling, and when a general denoiser beats a speech-only preset.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "podcast-audio-cleanup-checklist",
    title: "Podcast Audio Cleanup: A Practical Checklist",
    description:
      "A step-by-step order for cleaning up a podcast recording — rumble, noise, and loudness — and why doing them in the wrong order gives a worse result.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "fixing-echo-in-home-recordings",
    title: "How to Fix Echo in Home Recordings",
    description:
      "The difference between slap-back echo and room reverb, why one gates out cleanly and the other doesn't, and what to expect from echo reduction tools.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "editing-out-dead-air-podcasts",
    title: "Cutting Dead Air from Podcasts & Recordings",
    description:
      "How silence threshold and minimum gap length work together, why cutting too aggressively clips natural pauses, and how to tune both for your recording.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  {
    slug: "transcribing-audio-accurately",
    title: "How to Get Accurate Audio Transcripts",
    description:
      "What actually affects transcription accuracy — audio quality, overlapping speech, background noise — and how to prep a file before transcribing it.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
  },
  
];

export function getGuideBySlug(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}