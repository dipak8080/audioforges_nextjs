export const CHANGELOG_INDEXABLE = false;

export interface ChangelogEntry {
  date: string;
  title: string;
  body: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-09-26",
    title: "Forge 2 engine in Studio",
    body: "Studio now runs Forge 2, our newest separation engine. Cleaner vocals, and every stem in one pass, at the same price.",
  },
  {
    date: "2026-09-26",
    title: "Studio on YouTube links",
    body: "Paste a YouTube link and run it in Studio, at the same price as an upload.",
  },
  {
    date: "2026-09-23",
    title: "Batch Studio runs",
    body: "Drop up to 20 songs and run them as one batch. One song each, and one ZIP at the end.",
  },
  {
    date: "2026-09-21",
    title: "MP3 stems, key and BPM on results",
    body: "Download stems as WAV or MP3, and see the key, Camelot code and tempo on every separation.",
  },
];