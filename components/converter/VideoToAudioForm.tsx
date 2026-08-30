"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ControlField, Hint, OptionCards, type CardOption } from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { formatBytes, formatDuration, getToolLimits } from "@/lib/data/tool-limits";
import type { FileValidationResult } from "@/lib/types/converter";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE ONE-HOUR DURATION CAP WASN'T CHECKED, AND THE PREVIEW ALREADY KNEW.
 *    VIDEO_EXTRACT_MAX_DURATION_SECONDS is 3600, and a 200MB file can easily
 *    be longer than that — phone video at a low bitrate, a screen recording, a
 *    lecture capture. Those upload in full, over a connection that makes 200MB
 *    slow, and are refused at the end. VideoPreview was already decoding the
 *    duration to display it; it's reported up now and gates the submit before
 *    a byte leaves.
 *
 * 2. 200MB WAS WRITTEN IN THREE PLACES — the constant, the drop-zone hint and
 *    the validator's error message. TOOL_LIMITS carries it once.
 *
 * 3. THE PREVIEW COULD HANG ON "Reading video…" FOREVER. It waits for
 *    `onseeked`, and some containers fire neither that nor `onerror` — the
 *    card then sits on its placeholder for the life of the page. A ceiling
 *    resolves it to whatever's known, the same guard readMediaDuration
 *    already has.
 *
 * 4. THE FORMAT PICKER WAS ANOTHER FAKE radiogroup. It also carried the one
 *    piece of information that changes what this tool DOES — Fast copy versus
 *    Re-encode — so the teal it used for "instant" is preserved through
 *    OptionCards' new `metaTone`, rather than flattened into the standard
 *    amber.
 *
 * 5. A 429 NAMES THE LIMIT.
 */

const VIDEO_LIMITS = getToolLimits("video-to-audio");
const MAX_VIDEO_BYTES = VIDEO_LIMITS?.maxFileBytes ?? 90 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = VIDEO_LIMITS?.maxTotalDurationSeconds ?? 3600;
const MAX_BYTES_LABEL = formatBytes(MAX_VIDEO_BYTES);
const MAX_DURATION_LABEL = formatDuration(MAX_VIDEO_DURATION_SECONDS);

const RATE_LIMIT_LABEL = getRateLimitLabel("video-to-audio");

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

/* Fast copy stays teal through the shared card: it's not a spec, it's the
   difference between "instant" and "wait for a full re-encode". */
const FORMAT_OPTIONS: CardOption<string>[] = OUTPUT_FORMATS.map((fmt) => ({
  value: fmt.value,
  title: fmt.label,
  meta: fmt.tag,
  metaTone: fmt.tag === "Fast copy" ? "good" : "default",
  detail: fmt.note,
}));

const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "avi", "webm", "flv", "wmv", "m4v", "3gp", "mpeg", "mpg"];
const VIDEO_ACCEPT = `video/*,${VIDEO_EXTENSIONS.map((e) => `.${e}`).join(",")}`;

/** Past this, the probe is treated as having failed. Some containers fire
 *  neither `seeked` nor `error`, and the card would wait forever. */
const PROBE_TIMEOUT_MS = 8_000;

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
    // The cap comes from TOOL_LIMITS rather than being typed a second time
    // here and a third time in the drop-zone hint.
    return {
      isValid: false,
      error: `File too large (${sizeMb}MB). Maximum allowed size is ${MAX_BYTES_LABEL}.`,
    };
  }

  if (file.size === 0) {
    return { isValid: false, error: "This file is empty." };
  }

  return { isValid: true };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
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

function VideoPreview({
  file,
  onDuration,
}: {
  file: File;
  /** Reported up so the form can gate on the duration cap. The decode is
   *  happening either way; the number was just being thrown away. */
  onDuration: (seconds: number | null) => void;
}) {
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    setInfo(null);
    setFailed(false);
    onDuration(null);

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    const finish = (next: VideoInfo | null) => {
      if (settled || cancelled) return;
      settled = true;
      clearTimeout(timer);
      if (next) {
        setInfo(next);
        onDuration(Number.isFinite(next.duration) ? next.duration : null);
      } else {
        setFailed(true);
        onDuration(null);
      }
      cleanup();
    };

    // Neither `seeked` nor `error` is guaranteed to fire — on those
    // containers the card used to sit on "Reading video…" for the life of
    // the page. Resolve to whatever metadata arrived, or to failed.
    const timer = setTimeout(() => {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        finish({
          duration,
          width: video.videoWidth,
          height: video.videoHeight,
          thumbnailUrl: null,
        });
      } else {
        finish(null);
      }
    }, PROBE_TIMEOUT_MS);

    video.onloadedmetadata = () => {
      if (cancelled) return;
      // Seek slightly past the start — the very first frame is often a
      // black flash or fade-in, a fraction of a second in usually looks
      // like the actual footage.
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      if (cancelled) return;
      const base = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish({ ...base, thumbnailUrl: canvas.toDataURL("image/jpeg", 0.7) });
      } catch {
        // Some codecs decode metadata fine but refuse canvas capture
        // (rare, but happens with certain hardware-decoded formats) —
        // fall back to numbers only, no thumbnail.
        finish({ ...base, thumbnailUrl: null });
      }
    };

    video.onerror = () => finish(null);
    video.src = objectUrl;

    return () => {
      cancelled = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      cleanup();
    };
    // onDuration is a stable setState from the parent; including it would
    // re-probe the file on every unrelated render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  if (failed) return null; // Extraction still works — this is cosmetic only.

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-graphite-800 bg-graphite-850/60 p-3">
      <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-graphite-800">
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
  const [duration, setDuration] = useState<number | null>(null);
  const activeSpec = OUTPUT_FORMATS.find((f) => f.value === format) ?? OUTPUT_FORMATS[0];

  // null means the browser couldn't read it — let the server decide rather
  // than blocking a file that may be perfectly valid.
  const tooLong = duration !== null && duration > MAX_VIDEO_DURATION_SECONDS;

  return (
    <JobToolForm
      endpoint="video-to-audio"
      fileAccept={VIDEO_ACCEPT}
      fileHint={`${VIDEO_EXTENSIONS.slice(0, 5).join(", ").toUpperCase()}, and more — up to ${MAX_BYTES_LABEL}, ${MAX_DURATION_LABEL}`}
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
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Video extraction is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the video container" },
        { at: 3, label: activeSpec.tag === "Fast copy" ? "Copying the audio track" : "Re-encoding the audio" },
        { at: 8, label: "Writing the output file" },
      ]}
      /*
        200MB over a slow connection is a long upload to spend on a file the
        server will refuse on length. The preview has already decoded the
        duration by the time anyone reaches the button.
      */
      buildExtraFields={() => (tooLong ? null : { target_format: format })}
      missingFieldsMessage={
        tooLong && duration !== null
          ? `This video is ${formatTime(duration)}. Extraction is limited to ${MAX_DURATION_LABEL} — trim it first, or extract a shorter clip.`
          : undefined
      }
      renderControls={(file, disabled) => (
        <div className="space-y-4">
          {file && <VideoPreview file={file} onDuration={setDuration} />}

          {tooLong && duration !== null && (
            <Hint tone="bad" title={`Too long to extract (${formatTime(duration)})`}>
              The limit is {MAX_DURATION_LABEL}. Nothing has been uploaded — trim the video first, or
              use a shorter clip.
            </Hint>
          )}

          <ControlField
            as="fieldset"
            label="Output format"
            hint="Most videos carry AAC audio — choosing M4A or AAC copies it out losslessly and finishes almost instantly. Every other format requires a full re-encode, which takes longer."
          >
            <OptionCards
              label="Output format"
              options={FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
              columns={4}
              disabled={disabled}
              mono
            />
          </ControlField>
        </div>
      )}
    />
  );
}