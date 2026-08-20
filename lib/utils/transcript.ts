// lib/utils/transcript.ts
//
// The API returns JSON only — every export format is built here from
// `segments`, with no extra request. That's what makes SRT and VTT export
// free to offer: it costs a string concat, not server time.

import type { Transcript, TranscriptSegment } from "@/lib/api/transcription";

export type TranscriptFormat = "txt" | "srt" | "vtt";

export interface TranscriptFormatSpec {
  value: TranscriptFormat;
  label: string;
  extension: string;
  mimeType: string;
  /** One line, shown under the label. Says what it's FOR, not what it is. */
  hint: string;
}

export const TRANSCRIPT_FORMATS: TranscriptFormatSpec[] = [
  {
    value: "txt",
    label: "TXT",
    extension: "txt",
    mimeType: "text/plain;charset=utf-8",
    hint: "Plain text, one line per segment",
  },
  {
    value: "srt",
    label: "SRT",
    extension: "srt",
    mimeType: "application/x-subrip;charset=utf-8",
    hint: "Subtitles for video editors",
  },
  {
    value: "vtt",
    label: "VTT",
    extension: "vtt",
    mimeType: "text/vtt;charset=utf-8",
    hint: "Web captions for HTML5 video",
  },
];

/* ------------------------------------------------------------------ */
/* Timestamps                                                          */
/* ------------------------------------------------------------------ */

/**
 * The ONLY difference between SRT and VTT timestamps is the separator
 * before milliseconds: SRT uses a comma, VTT uses a period. Editors and
 * browsers reject files that get this wrong, and the failure is silent —
 * the file loads and shows nothing — so it's worth the explicit param
 * rather than two near-identical functions that can drift apart.
 */
function timestamp(totalSeconds: number, msSeparator: "," | "."): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe / 60) % 60;
  const seconds = Math.floor(safe) % 60;
  // Truncate rather than round: rounding 3.9996 up to a full second
  // pushes a cue's end past the next cue's start, which some players
  // treat as overlapping and drop.
  const milliseconds = Math.floor((safe % 1) * 1000);

  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${msSeparator}${pad(milliseconds, 3)}`;
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

/**
 * One segment per line rather than `transcript.text`, which joins
 * everything with single spaces into one enormous paragraph. For an
 * interview or a lecture the line breaks are most of the readability.
 */
export function toTxt(transcript: Transcript): string {
  const body = transcript.segments.length
    ? transcript.segments.map((s) => s.text.trim()).filter(Boolean).join("\n")
    : transcript.text.trim();
  return `${body}\n`;
}

/** SRT: 1-based index, comma before milliseconds, blank line between
 *  blocks, and a trailing newline. */
export function toSrt(segments: TranscriptSegment[]): string {
  return (
    segments
      .map((segment, i) => {
        const start = timestamp(segment.start, ",");
        const end = timestamp(Math.max(segment.end, segment.start + 0.001), ",");
        return `${i + 1}\n${start} --> ${end}\n${segment.text.trim()}\n`;
      })
      .join("\n") + "\n"
  );
}

/** VTT: literal WEBVTT header, period before milliseconds, no index. */
export function toVtt(segments: TranscriptSegment[]): string {
  const body = segments
    .map((segment) => {
      const start = timestamp(segment.start, ".");
      const end = timestamp(Math.max(segment.end, segment.start + 0.001), ".");
      return `${start} --> ${end}\n${segment.text.trim()}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

export function buildTranscript(transcript: Transcript, format: TranscriptFormat): string {
  switch (format) {
    case "srt":
      return toSrt(transcript.segments);
    case "vtt":
      return toVtt(transcript.segments);
    case "txt":
    default:
      return toTxt(transcript);
  }
}

/* ------------------------------------------------------------------ */
/* Filenames                                                           */
/* ------------------------------------------------------------------ */

/**
 * Same rule as the converter's safeFilename: strip only what a
 * filesystem actually rejects, so a Devanagari or CJK title survives
 * instead of being erased down to the fallback. Windows is the strictest
 * target, so we match its reserved set.
 */
export function transcriptFilename(
  title: string | null | undefined,
  format: TranscriptFormat,
  fallback = "transcript"
): string {
  const spec = TRANSCRIPT_FORMATS.find((f) => f.value === format) ?? TRANSCRIPT_FORMATS[0];

  const cleaned = (title ?? "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 100)
    .trim();

  return `${cleaned || fallback}.${spec.extension}`;
}

/* ------------------------------------------------------------------ */
/* Download                                                            */
/* ------------------------------------------------------------------ */

/**
 * Must be called from a real click, never after an await — a synthetic
 * click outside a trusted gesture gets dropped silently by Safari, and
 * the UI then claims a save that never happened.
 */
export function downloadTranscript(
  transcript: Transcript,
  format: TranscriptFormat,
  title: string | null | undefined
): void {
  const spec = TRANSCRIPT_FORMATS.find((f) => f.value === format) ?? TRANSCRIPT_FORMATS[0];
  const content = buildTranscript(transcript, format);

  // BOM so Windows Notepad and Excel read UTF-8 correctly. Without it a
  // Nepali or accented transcript opens as mojibake, which reads as a
  // broken tool rather than a broken text editor.
  const blob = new Blob(["\uFEFF", content], { type: spec.mimeType });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = transcriptFilename(title, format);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/** mm:ss for the transcript viewer's clickable timestamps. Deliberately
 *  not the SRT format — a reader wants 1:23, not 00:01:23,000. */
export function formatSegmentTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatTranscriptDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const secs = Math.round(safe % 60);
  if (minutes < 1) return `${secs} sec`;
  return `${minutes} min ${String(secs).padStart(2, "0")} sec`;
}

/** Rough figure for the result header. Deliberately called an estimate
 *  in the UI — it's a whitespace split, not a linguistic word count. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}