"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";
import type { FileValidationResult } from "@/lib/types/converter";

interface FormatSpec {
  value: string;
  label: string;
  tag: "Fast copy" | "Re-encode";
  note: string;
}

const OUTPUT_FORMATS: FormatSpec[] = [
  { value: "m4a", label: "M4A", tag: "Fast copy", note: "AAC in an M4A container — plays everywhere" },
  { value: "aac", label: "AAC", tag: "Fast copy", note: "Raw AAC stream — smaller, less universal" },
  { value: "mp3", label: "MP3", tag: "Re-encode", note: "Widely compatible" },
  { value: "wav", label: "WAV", tag: "Re-encode", note: "Uncompressed" },
  { value: "flac", label: "FLAC", tag: "Re-encode", note: "Lossless" },
  { value: "ogg", label: "OGG", tag: "Re-encode", note: "Open format" },
  { value: "aiff", label: "AIFF", tag: "Re-encode", note: "Uncompressed" },
];

const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "avi", "webm", "flv", "wmv", "m4v", "3gp", "mpeg", "mpg"];
const VIDEO_ACCEPT = `video/*,${VIDEO_EXTENSIONS.map((e) => `.${e}`).join(",")}`;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB - matches the backend's MAX_VIDEO_UPLOAD_BYTES

// video-to-audio is the one tool built on JobToolForm whose UPLOAD isn't
// audio - it needed its own validator rather than the default
// validateAudioFile, since that one rejects every video extension
// outright regardless of what fileAccept was set to (fileAccept only
// filters the file-picker DIALOG; drag-and-drop bypasses it entirely,
// so the actual JS validation has to know about video formats too).
function validateVideoFile(file: File): FileValidationResult {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (!VIDEO_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: `.${ext || "this file"} isn't a supported video format. Supported: ${VIDEO_EXTENSIONS.join(", ").toUpperCase()}.`,
    };
  }

  if (file.size > MAX_VIDEO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File too large (${sizeMb}MB). Maximum allowed size is 200MB.`,
    };
  }

  if (file.size === 0) {
    return { isValid: false, error: "This file is empty." };
  }

  return { isValid: true };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Video frame preview — confirms it's the right clip before extracting */
/* ------------------------------------------------------------------ */

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string | null;
}

function VideoPreview({ file }: { file: File }) {
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setFailed(false);

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.onloadedmetadata = () => {
      if (cancelled) return;
      // Seek slightly past the start — the very first frame is often a
      // black flash or fade-in, a fraction of a second in usually looks
      // like the actual footage.
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7);
        setInfo({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, thumbnailUrl });
      } catch {
        // Some codecs decode metadata fine but refuse canvas capture
        // (rare, but happens with certain hardware-decoded formats) —
        // fall back to numbers only, no thumbnail.
        setInfo({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, thumbnailUrl: null });
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      if (!cancelled) setFailed(true);
      cleanup();
    };

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [file]);

  if (failed) return null; // Extraction still works — this is cosmetic only.

  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-graphite-800 bg-graphite-850/60 p-3">
      <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-graphite-800">
        {info?.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={info.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Film className="h-5 w-5 text-text-subtle" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
        <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
          {info ? `${info.width}×${info.height} · ${formatTime(info.duration)}` : "Reading video…"}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function VideoToAudioForm() {
  const [format, setFormat] = useState("m4a");
  const activeSpec = OUTPUT_FORMATS.find((f) => f.value === format) ?? OUTPUT_FORMATS[0];

  return (
    <JobToolForm
      endpoint="video-to-audio"
      fileAccept={VIDEO_ACCEPT}
      fileHint={`${VIDEO_EXTENSIONS.slice(0, 5).join(", ").toUpperCase()}, and more — up to 200MB`}
      validateFile={validateVideoFile}
      pollIntervalMs={3000}
      submitTimeoutMs={120_000}
      toolLabel="Video to audio"
      toolMeta={`→ ${activeSpec.label}`}
      submitLabel="Extract audio"
      processingLabel="Extracting audio"
      expectedRange="under a minute, faster for M4A/AAC"
      resultVerb="Extracted"
      downloadFilename={format}
      stages={[
        { at: 0, label: "Reading the video container" },
        { at: 3, label: activeSpec.tag === "Fast copy" ? "Copying the audio track" : "Re-encoding the audio" },
        { at: 8, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ target_format: format })}
      renderControls={(file, disabled) => (
        <div className="space-y-4">
          {file && <VideoPreview file={file} />}

          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="mb-2 text-sm font-medium text-text-primary">Output format</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Output format">
              {OUTPUT_FORMATS.map((fmt) => {
                const selected = format === fmt.value;
                return (
                  <button
                    key={fmt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormat(fmt.value)}
                    disabled={disabled}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      selected
                        ? "border-amber-500/60 bg-amber-500/[0.07]"
                        : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span
                        className={cn(
                          "font-mono text-sm font-semibold uppercase",
                          selected ? "text-amber-400" : "text-text-primary"
                        )}
                      >
                        {fmt.label}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-medium uppercase tracking-wide",
                          fmt.tag === "Fast copy"
                            ? selected
                              ? "text-teal-400"
                              : "text-teal-500/70"
                            : selected
                              ? "text-amber-500/80"
                              : "text-text-subtle"
                        )}
                      >
                        {fmt.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-text-muted">{fmt.note}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] leading-snug text-text-subtle">
              Most videos carry AAC audio — choosing M4A or AAC copies it out losslessly and finishes almost
              instantly. Every other format requires a full re-encode, which takes longer.
            </p>
          </fieldset>
        </div>
      )}
    />
  );
}