export type NavIcon = "mic" | "layers" | "waves" | "split" | "piano" | "score" | "gauge";

export interface NavItem {
  key: "vocalRemover" | "stemSplitter" | "forgeClean" | "forgeSplit" | "midi" | "sheet" | "keyBpm";
  href: string;
  icon: NavIcon;
}

export interface NavGroup {
  key: "separate" | "create" | "analyze";
  items: NavItem[];
}

export const STUDIO_MENU: NavGroup[] = [
  {
    key: "separate",
    items: [
      { key: "vocalRemover", href: "/vocal-remover", icon: "mic" },
      { key: "stemSplitter", href: "/stems", icon: "layers" },
      { key: "forgeClean", href: "/echo-reverb-remover", icon: "waves" },
      { key: "forgeSplit", href: "/lead-backing-vocal-splitter", icon: "split" },
    ],
  },
  {
    key: "create",
    items: [
      { key: "midi", href: "/audio-to-midi", icon: "piano" },
      { key: "sheet", href: "/audio-to-sheet-music", icon: "score" },
    ],
  },
  { key: "analyze", items: [{ key: "keyBpm", href: "/key-finder", icon: "gauge" }] },
];

export const FREE_TOOL_LINKS = [
  { href: "/youtube-to-wav", label: "YouTube to WAV" },
  { href: "/youtube-to-mp3", label: "YouTube to MP3" },
  { href: "/tiktok-to-mp3", label: "TikTok to MP3" },
  { href: "/voice-recorder", label: "Voice Recorder" },
];