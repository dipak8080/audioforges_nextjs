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
    updatedDate: "2026-07-21",
  },
  {
    slug: "dj-set-prep-checklist",
    title: "DJ Set Prep Checklist: From Reference Track to Playlist",
    description:
      "A practical, step-by-step workflow for prepping a DJ set — from gathering reference tracks to key-matching and ordering the final playlist.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-21",
  },
  {
    slug: "finding-reference-tracks",
    title: "How to Find Clean Reference Tracks for Production",
    description:
      "Where to find reference tracks, how to evaluate them for a session, and how to prep them so they're actually useful for mixing decisions.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-21",
  },
];

export function getGuideBySlug(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}