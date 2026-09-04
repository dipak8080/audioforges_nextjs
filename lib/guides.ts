export interface Guide {
  slug: string;
  title: string;
  description: string;
  publishedDate: string; // ISO format
  updatedDate: string;   // ISO format
  category: "dj-mixing" | "production" | "podcast-cleanup";
}

export const guides: Guide[] = [
  {
    slug: "camelot-wheel-harmonic-mixing",
    title: "Camelot Wheel: Harmonic Mixing for DJs",
    description:
      "How the Camelot Wheel works, why harmonic mixing makes sets flow, and how to use key compatibility when building a set.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-21",
    category: "dj-mixing",
  },
  {
    slug: "wav-vs-mp3-for-sampling",
    title: "WAV vs MP3 for Sampling: What Actually Changes",
    description:
      "The real technical differences between WAV and MP3 for sampling, layering, and production, and when the difference actually matters.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-24",
    category: "production",
  },
  {
    slug: "dj-set-prep-checklist",
    title: "DJ Set Prep Checklist: 6 Steps to a Set That Flows",
    description:
      "A 6-step DJ set prep workflow: gather tracks, tag key and BPM, group by Camelot compatibility, and order for energy before you play.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-24",
    category: "dj-mixing",
  },
  {
    slug: "finding-reference-tracks",
    title: "How to Find Reference Tracks That Actually Help",
    description:
      "How to pick reference tracks for a specific purpose, match their role to your mix, and get them into a usable local format for A/B comparison.",
    publishedDate: "2026-07-21",
    updatedDate: "2026-07-24",
    category: "production",
  },
  {
    slug: "ai-vocal-removal-explained",
    title: "How AI Vocal Removal Actually Works",
    description:
      "Why AI source separation beats a center-channel filter, the real difference between an instrumental and an acapella, and where separation still struggles.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "production",
  },
  {
    slug: "lossless-vs-lossy-audio-formats",
    title: "Lossless vs Lossy Audio: Which Format to Use",
    description:
      "The real difference between lossless and lossy audio, and why converting MP3 to WAV won't recover quality you've already lost.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "production",
  },
  {
    slug: "how-to-trim-audio-without-losing-quality",
    title: "How to Trim Audio Without Losing Quality",
    description:
      "Why trimming a lossless file is bit-perfect but a lossy file depends on cut placement, and how to avoid a click at your trim point.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "production",
  },
  {
    slug: "gain-staging-for-home-studios",
    title: "Gain Staging Explained for Home Studios",
    description:
      "How decibels work, why clipping happens at the top of the range, and where to set gain before other processing so nothing distorts downstream.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "production",
  },
  {
    slug: "pitch-shifting-vs-key-changing",
    title: "Pitch Shifting Explained: Semitones & Musical Keys",
    description:
      "Why shifting pitch by semitones is different from just speeding up or slowing down a track, and how to pick a comfortable vocal range without changing tempo.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "dj-mixing",
  },
  {
    slug: "dj-tempo-matching-without-pitch-shift",
    title: "How to Match Tempo Without Changing Pitch",
    description:
      "Why nudging a track's speed for a mashup or DJ set doesn't have to shift its key, and how much tempo change you can get away with before it sounds off.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "dj-mixing",
  },
  {
    slug: "reversed-audio-in-music-production",
    title: "Reversed Audio: Creative Uses in Production",
    description:
      "How reversed cymbals, vocal chops, and risers are actually built, plus the backmasking curiosity that made reversed audio famous in the first place.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "production",
  },
  {
    slug: "removing-background-noise-from-recordings",
    title: "How to Remove Background Noise from Audio",
    description:
      "How FFT-based noise reduction actually works, why pushing the strength too high causes warbling, and when a general denoiser beats a speech-only preset.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "podcast-cleanup",
  },
  {
    slug: "podcast-audio-cleanup-checklist",
    title: "Podcast Audio Cleanup: A Practical Checklist",
    description:
      "A step-by-step order for cleaning up a podcast recording: rumble, noise, and loudness, and why doing them in the wrong order gives a worse result.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "podcast-cleanup",
  },
  {
    slug: "fixing-echo-in-home-recordings",
    title: "How to Fix Echo in Home Recordings",
    description:
      "The difference between slap-back echo and room reverb, why one gates out cleanly and the other doesn't, and what to expect from echo reduction tools.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "podcast-cleanup",
  },
  {
    slug: "editing-out-dead-air-podcasts",
    title: "Cutting Dead Air from Podcasts & Recordings",
    description:
      "How silence threshold and minimum gap length work together, why cutting too aggressively clips natural pauses, and how to tune both for your recording.",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    category: "podcast-cleanup",
  },
  {
    slug: "transcribing-audio-accurately",
    title: "How to Improve Transcription Accuracy",
    description:
      "Why transcripts come back wrong, and what to fix first. Audio cleanup, language selection, SRT vs VTT, and handling recordings over 20 minutes.",
    publishedDate: "2026-08-20",
    updatedDate: "2026-08-20",
    category: "podcast-cleanup",
  },
  {
    slug: "ai-stem-separation-explained",
    title: "How AI Stem Separation Actually Works",
    description:
      "How a single AI model splits a track into vocals, drums, bass, and other, why it's harder than a 2-stem split, and what Studio Quality actually changes.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "splitting-a-recording-into-separate-tracks",
    title: "How to Split a Recording by Silence",
    description:
      "How splitting a recording at silent gaps works, how to tune the threshold and gap length, and when to use manual cutting instead.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "dj-mixing",
  },
  {
    slug: "why-audio-needs-a-fade-in-out",
    title: "Why Trimmed Audio Clips Need a Fade In and Out",
    description:
      "Why a hard cut at the start or end of audio causes a click or pop, how a fade in or fade out fixes it, and how long to make one.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "mono-vs-stereo-what-changes",
    title: "Mono vs Stereo: What's the Difference?",
    description:
      "Mono is one channel, stereo is two. What actually changes when you convert between them, why mono-to-stereo adds no width, and how to check a mix in mono.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-23",
    category: "production",
  },
  {
    slug: "sample-rate-and-bit-depth-explained",
    title: "Sample Rate and Bit Depth Explained",
    description:
      "What sample rate and bit depth actually measure, why converting to a higher sample rate doesn't add quality, and when you genuinely need to change either.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "what-is-lufs-loudness-explained",
    title: "What Is LUFS Loudness, Explained",
    description:
      "Why LUFS measures perceived loudness differently than peak level, why streaming platforms normalize playback, and why two-pass measurement matters.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "what-is-an-m4r-file-explained",
    title: "What Is an M4R File? iPhone Ringtone Explained",
    description:
      "Why an M4R file is just AAC audio with a different extension, why iPhone ringtones cap at 30 seconds, and how to pick a good clip.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "why-you-cant-just-concatenate-audio-files",
    title: "Why You Can't Just Concatenate Audio Files",
    description:
      "Why joining audio files recorded at different sample rates can break playback, and how normalizing before joining fixes it.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "how-key-and-bpm-detection-works",
    title: "How Automatic Key and BPM Detection Actually Works",
    description:
      "Why key and BPM detection can disagree between passes, why confidence scores matter, and why only part of a track gets analyzed.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "dj-mixing",
  },
  {
    slug: "how-youtube-tools-fetch-then-process",
    title: "How AudioForges' YouTube Tools Work",
    description:
      "Why pasting a YouTube link takes longer than uploading a file, why private or restricted videos can't be processed, and what determines wait time.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "why-your-browser-can-record-without-uploading",
    title: "Why Your Browser Records Without Uploading",
    description:
      "How browser-based recording works entirely on your device, why the output format depends on your browser, and how to get a cleaner recording.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "podcast-cleanup",
  },
  {
    slug: "why-online-metronomes-drift",
    title: "Why Online Metronomes Drift Out of Time",
    description:
      "Why a basic JavaScript timer causes an online metronome to drift, and how scheduling clicks against the audio clock ahead of time fixes it.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "how-tap-tempo-detection-works",
    title: "How Tap Tempo Detection Actually Works",
    description:
      "Why tap tempo tools only average your most recent taps, why a pause resets the count, and how to get a stable BPM reading.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "dj-mixing",
  },
  {
    slug: "how-instrument-tuners-detect-pitch",
    title: "How Instrument Tuners Actually Detect Pitch",
    description:
      "Why tuners analyze the waveform directly instead of picking the loudest frequency, and why they turn off echo cancellation and noise suppression.",
    publishedDate: "2026-08-01",
    updatedDate: "2026-08-01",
    category: "production",
  },
  {
    slug: "bpm-detection-tempocnn",
    title: "BPM Detection: 42% to 85% With TempoCNN",
    description:
      "Tempo detection from one DSP detector to consensus voting to a pretrained TempoCNN — measured on GiantSteps, with what failed and what's still broken.",
    publishedDate: "2026-09-04",
    updatedDate: "2026-09-04",
    category: "dj-mixing",
  },
  {
    slug: "why-m4a-extraction-is-instant",
    title: "Why M4A Extraction Is Instant (WAV Isn't)",
    description:
      "Why pulling M4A/AAC audio from a video is a fast container remux, why WAV or FLAC extraction takes real time, and when lossless output is worth it.",
    publishedDate: "2026-08-02",
    updatedDate: "2026-08-02",
    category: "production",
  },
  {
    slug: "how-audio-to-midi-transcription-works",
    title: "How Audio to MIDI Transcription Actually Works",
    description:
      "How audio-to-MIDI transcription detects pitch and timing, why single melodies convert cleaner than chords, and what onset and frame thresholds control.",
    publishedDate: "2026-08-13",
    updatedDate: "2026-08-13",
    category: "production",
  },
  {
    slug: "tiktok-audio-quality-explained",
    title: "TikTok Audio Quality: Why 320 kbps Is a Myth",
    description:
      "TikTok's source audio measures around 64 kbps AAC. Here's why converting it to a 320 kbps MP3 can't add quality back — and what actually does matter.",
    publishedDate: "2026-08-18",
    updatedDate: "2026-08-18",
    category: "production",
  },
  {
    slug: "tiktok-sound-to-ringtone",
    title: "How to Make a Ringtone from a TikTok Sound",
    description:
      "Turn a TikTok sound into a phone ringtone: where to cut the hook, how long to make it, why it needs a fade, and how to actually install it on iPhone or Android.",
    publishedDate: "2026-08-18",
    updatedDate: "2026-08-18",
    category: "production",
  },
  {
    slug: "how-audio-to-sheet-music-works",
    title: "How Audio to Sheet Music Transcription Works",
    description:
      "How AI turns a recording into sheet music — note detection, tempo and key, quantization and engraving — and how to fix the result in MuseScore.",
    publishedDate: "2026-09-03",
    updatedDate: "2026-09-03",
    category: "production",
  },
];

export function getGuideBySlug(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}