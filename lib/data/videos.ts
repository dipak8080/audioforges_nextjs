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
  "game-audio-format": {
    videoId: "SEVFgH35BVE",
    title: "Game Audio Format: WAV vs OGG, 48 kHz, Mono SFX (Unity, Unreal, Godot)",
    description:
      "Prep sound effects and music for Unity, Unreal and Godot: trim silence, convert SFX to mono, resample to 48 kHz 16-bit WAV, and convert music to OGG, free in the browser.",
    uploadDate: "2026-09-06",
    heading: "Watch: the batch-prep workflow",
    pageUrl: "/guides/audio-format-for-game-engines-unity-unreal-godot",
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
  "vocal-remover": {
    videoId: "ci0cLOFwwb8",
    title: "Free Vocal Remover — Remove Vocals from Any Song or YouTube Video",
    description:
      "Remove vocals from any song, or keep just the vocal, free in the browser. Upload a file or paste a YouTube link. Runs htdemucs, so vocals are separated by AI rather than EQ'd out. No signup.",
    uploadDate: "2026-09-06",
    heading: "Watch: vocals out of a file or a YouTube link",
  },
  "youtube-vocal-remover": {
    videoId: "ci0cLOFwwb8",
    title: "Free Vocal Remover — Remove Vocals from Any Song or YouTube Video",
    description:
      "Paste a YouTube link and get the instrumental and acapella in about a minute, or upload a file. AI separation via htdemucs. No signup, no install.",
    uploadDate: "2026-09-06",
    heading: "Watch: vocals removed straight from a YouTube link",
  },
  stems: {
    videoId: "JO9xCQhdZwo",
    title: "Free Stem Splitter — Split Any Song or YouTube Video into Stems",
    description:
      "Split any song into vocals, drums, bass, guitar, piano and other, free in the browser. Upload a file or paste a YouTube link. 2, 4 or 6 stems via htdemucs. No signup.",
    uploadDate: "2026-09-06",
    heading: "Watch: stems from a file or a YouTube link",
  },
  "youtube-stem-splitter": {
    videoId: "JO9xCQhdZwo",
    title: "Free Stem Splitter — Split Any Song or YouTube Video into Stems",
    description:
      "Paste a YouTube link and get separate vocal, drum, bass and instrument stems in a minute, or upload a file. AI separation via htdemucs. No signup, no install.",
    uploadDate: "2026-09-06",
    heading: "Watch: stems straight from a YouTube link",
  },
  "youtube-to-wav": {
    videoId: "J6q9WSnVZlw",
    title: "YouTube to WAV — Convert YouTube Audio to Lossless WAV Free, No App",
    description:
      "Paste a YouTube link and download lossless WAV audio in the browser. Free, no signup, no app, no watermark. Supports watch links, youtu.be and Shorts.",
    uploadDate: "2026-09-06",
    heading: "Watch: YouTube link to WAV in under a minute",
  },
  "audio-to-sheet-music": {
    videoId: "cj97mCNmCyI",
    title: "Audio to Sheet Music Free — Piano, Guitar & Vocals to PDF, MusicXML & MIDI",
    description:
      "Upload MP3 or WAV, preview the engraved score and download PDF, MusicXML, MIDI or SVG. Piano uses a dedicated model with a two-hand grand staff; key detection sets the key signature. Free, no signup.",
    uploadDate: "2026-09-06",
    heading: "Watch: recording to printable score",
  },
};