export type ToolVideo = {
  videoId: string;
  title: string;
  description: string;
  uploadDate: string;
  heading?: string;
};

// One entry per tool page. Key = route slug without leading slash.
export const TOOL_VIDEOS: Record<string, ToolVideo> = {
  "audio-to-midi": {
    videoId: "AATpOov3LFI",
    title: "Audio to MIDI Converter — Free, Online, No Install",
    description:
      "Upload a vocal, piano or any melody and get a MIDI file in seconds. Runs Spotify's Basic Pitch in the browser, with an optional higher-quality multi-instrument model. No signup, no install.",
    uploadDate: "2026-09-05",
    heading: "Watch: audio to MIDI in under two minutes",
  },
};