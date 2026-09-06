export type ToolVideo = {
  videoId: string;
  title: string;
  description: string;
  uploadDate: string;
  heading?: string;
  pageUrl?: string;
};

// One entry per page. Key = a short id; pageUrl defaults to `/${key}` for tool
// pages, so only guides (or anything not at the root) need it set explicitly.
export const TOOL_VIDEOS: Record<string, ToolVideo> = {
  "audio-to-midi": {
    videoId: "AATpOov3LFI",
    title: "Audio to MIDI Converter — Free, Online, No Install",
    description:
      "Upload a vocal, piano or any melody and get a MIDI file in seconds. Runs Spotify's Basic Pitch in the browser, with an optional higher-quality multi-instrument model. No signup, no install.",
    uploadDate: "2026-09-05",
    heading: "Watch: audio to MIDI in under two minutes",
  },
  "phone-system-audio": {
    videoId: "g2UexDB-m90",
    title: "Convert Audio to 8 kHz Mono WAV for 3CX, Asterisk & IVR (Free, 1 Minute)",
    description:
      "Phone systems reject normal audio files. This shows the two-step fix: convert stereo to mono, then resample to 8 kHz 16-bit WAV, free in the browser.",
    uploadDate: "2026-09-06",
    heading: "Watch: the two-step conversion",
    pageUrl: "/guides/convert-audio-for-phone-systems-3cx-asterisk-ivr",
  },
  convert: {
    videoId: "yyUUOX8K1MQ",
    title: "Convert WAV to OGG Online — Free, No Signup",
    description:
      "Convert WAV to OGG Vorbis in the browser, free, with no signup or install. The same converter handles MP3, FLAC, M4A, AAC and AIFF.",
    uploadDate: "2026-09-06",
    heading: "Watch: WAV to OGG in under a minute",
  },
  "key-finder": {
    videoId: "Z8xAleqoVH0",
    title: "Find the Key & BPM of Any Song or YouTube Video — Free, No Signup",
    description:
      "Upload a track or paste a YouTube link and get the key, BPM, Camelot code and confidence in seconds. Runs Essentia's TempoCNN model; 85% exact-tempo accuracy on GiantSteps. No signup.",
    uploadDate: "2026-09-06",
    heading: "Watch: key and BPM from a file or a YouTube link",
  },
  "youtube-key-finder": {
    videoId: "Z8xAleqoVH0",
    title: "Find the Key & BPM of Any Song or YouTube Video — Free, No Signup",
    description:
      "Paste a YouTube link and get the key, BPM and Camelot code in seconds, or upload a file. Runs Essentia's TempoCNN model. No signup, no install.",
    uploadDate: "2026-09-06",
    heading: "Watch: key and BPM straight from a YouTube link",
  },
};