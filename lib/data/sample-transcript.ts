// lib/data/sample-transcript.ts
//
// Powers the "See a sample result" button on the transcription pages.
//
// WHY THIS IS PRE-BAKED RATHER THAN A REAL TRANSCRIPTION RUN
//
//   1. Rate limits. Transcription allows 2 submissions per 5 minutes per
//      IP. A demo that consumes one of someone's two attempts before
//      they've uploaded anything is actively hostile — they'd hit the
//      cooldown on their first real file.
//   2. Cold start. The GPU worker spins down when idle, so a genuine
//      sample run would sit on a spinner for up to 90 seconds. The whole
//      point of the demo is that it's instant.
//   3. It works when the backend doesn't. Someone landing during an
//      outage still sees what the tool produces.
//
// ─────────────────────────────────────────────────────────────────────
// THIS IS REAL OUTPUT. DO NOT "TIDY" IT.
// ─────────────────────────────────────────────────────────────────────
//
// Every word and timestamp below came out of /audio-to-text run against
// public/samples/sample.mp3 — the exact file the demo plays. That
// correspondence is the whole point: click-to-seek is the feature this
// demo exists to show, and it only works if the words match the audio.
//
// Segment 3 reads "the pallid bust of palace". Poe wrote "Pallas".
// LEAVE IT.
//
// The entire competitive position of these pages is that this is the one
// result in the SERP that doesn't invent an accuracy number. Silently
// hand-correcting the demo transcript is inventing one — and a visitor
// who runs the same public clip and gets "palace" has caught the site
// lying about the only thing it claims. One missed proper noun in 58
// seconds of nineteenth-century verse is a good showing; it reads as
// honest, not sloppy.
//
// TO REGENERATE (new clip, or after a model change):
//   1. Run the file through /audio-to-text on the live site.
//   2. Devtools → Network → the /result/ response → copy the JSON.
//   3. Paste it over SAMPLE_SEGMENTS and the fields below verbatim.
//   4. Update `attribution` to the new source and licence.
//   5. Replace public/samples/sample.mp3 in the same commit. The two
//      going out of sync is the failure mode this file is guarding.

import type { Transcript } from "@/lib/api/transcription";

export interface SampleTranscript {
  /** Shown as the result title. */
  title: string;
  /** Path under /public. Missing file degrades gracefully — AudioPlayer
   *  renders its "couldn't play this" state and the transcript still
   *  works, minus click-to-seek. */
  audioUrl: string;
  /** Source and licence, displayed under the sample banner. Required:
   *  a demo clip with no stated provenance is exactly the kind of
   *  hand-waving this site is positioned against. */
  attribution: string;
  transcript: Transcript;
}

/**
 * Timings taken from the SRT export, which carries them to the
 * millisecond. Note the gaps at 55.259→55.719 and 56.6→57.0: those are
 * real pauses in the reading, and they're why the last three segments
 * come back as separate rows rather than one run-on line.
 */
const SAMPLE_SEGMENTS = [
  {
    start: 0.0,
    end: 19.32,
    text: "Once upon a midnight dreary, while I pondered, weak and weary, over many a quaint and curious volume of forgotten lore, while I nodded, nearly napping, suddenly there came a tapping, as of someone gently rapping, rapping at my chamber door.",
  },
  {
    start: 19.32,
    end: 27.32,
    text: "\"'Tis some visitor,' I muttered, tapping at my chamber door, only this and nothing more.\"",
  },
  {
    start: 27.32,
    end: 43.439,
    text: "And the raven, never flitting, still is sitting, still is sitting, on the pallid bust of palace just above my chamber door, and his eyes have all the seeming of a demon's that is dreaming,",
  },
  {
    start: 43.439,
    end: 55.259,
    text: "and the lamplight o'er him streaming throws his shadow on the floor, and my soul from out that shadow that lies floating on the floor shall be lifted never more.",
  },
  { start: 55.719, end: 56.6, text: "Quoth the raven," },
  { start: 57.0, end: 57.28, text: "\"'Nevermore.'\"" },
  { start: 57.32, end: 57.64, text: "Nevermore." },
];

export const SAMPLE_TRANSCRIPT: SampleTranscript = {
  title: "the-raven-reading.mp3",
  audioUrl: "/samples/sample.mp3",
  attribution:
    "Recording from Pixabay, used under the Pixabay Content License. The text is Edgar Allan Poe's \"The Raven\" (1845), public domain.",
  transcript: {
    text: SAMPLE_SEGMENTS.map((s) => s.text).join(" "),
    language: "en",
    // NOT VERIFIED — see the note in the commit message.
    //
    // The /result/ JSON wasn't captured for this run, only the TXT, SRT
    // and VTT exports. `language_forced: true` makes TranscriptView
    // suppress the confidence figure entirely, which is the correct
    // behaviour when we don't have one: better to show nothing than to
    // print a probability nobody measured.
    //
    // If this clip was actually run on auto-detect, flip this to false
    // and paste the real `language_probability` from the API. Don't
    // guess a plausible-looking 0.98.
    language_forced: true,
    language_probability: 1.0,
    task: "transcribe",
    mode: "balanced",
    // The file runs 60s; the last segment ends at 57.640. Reporting the
    // segment extent made the meta line say "58 sec" four inches above a
    // player reading "1:00". The file length is the honest number.
    duration: 60,
    segments: SAMPLE_SEGMENTS,
  } satisfies Transcript,
};