"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Upload, FileAudio, FileVideo, X, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type MediaKind = "audio" | "video";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  currentFile: File | null;
  onClear: () => void;
  disabled?: boolean;
  accept?: string;
  /** Size cap in bytes. Used to build the default hint text. */
  maxSize?: number;
  /** Overrides the hint text entirely. Leave unset to have it derived
   *  from `accept` and `maxSize`. */
  hint?: string;

  /**
   * Duration in seconds, when the caller already knows it.
   *
   * Pass this and the local probe is skipped entirely. Leave it
   * `undefined` and the component decodes the file itself, which is the
   * old behaviour and what every other tool on the site still relies on.
   *
   * Worth passing: the transcription form calls `readMediaDuration()` on
   * the same file to validate the 20-minute cap, so with no prop the
   * browser decodes the header twice and creates two object URLs per
   * selected file.
   */
  duration?: number | null;

  /**
   * Marks the chosen file as rejected.
   *
   * Duration validation is async, so an over-long file is already sitting
   * in the card by the time the error appears underneath it. Without
   * this, the card looks perfectly fine while a red line below complains
   * about something the user has to infer is the same file.
   */
  invalid?: boolean;

  /**
   * Picks the icon and the default copy. Video files used to get a
   * `FileAudio` icon on `/video-to-text`, because there was only ever one
   * icon.
   */
  kind?: MediaKind;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toUpperCase() : "FILE";
}

/**
 * Reads the format list off `accept` rather than hardcoding it, so a tool
 * passing a different `accept` can't end up promising formats the file
 * picker won't allow.
 *
 * Capped at four: the full audio list runs to seven, which stops being
 * information and becomes texture.
 */
function formatsFromAccept(accept: string, kind: MediaKind): string {
  const extensions = accept
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("."))
    .map((part) => part.slice(1).toUpperCase());

  if (extensions.length > 4) return `${extensions.slice(0, 4).join(", ")} and more`;
  if (extensions.length > 0) return extensions.join(", ");
  return kind === "video" ? "Video files" : "Audio files";
}

export function FileDropZone({
  onFileSelect,
  currentFile,
  onClear,
  disabled,
  accept = "audio/*",
  maxSize,
  hint,
  duration: providedDuration,
  invalid = false,
  kind = "audio",
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [probedDuration, setProbedDuration] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // dragleave fires when the pointer crosses a child element, which makes
  // the highlight flicker. Counting enters and leaves fixes it.
  const dragDepth = useRef(0);

  const ownsProbe = providedDuration === undefined;
  const duration = ownsProbe ? probedDuration : providedDuration;

  const resolvedHint =
    hint ??
    `${formatsFromAccept(accept, kind)}${
      maxSize ? ` · up to ${Math.round(maxSize / (1024 * 1024))} MB` : ""
    }`;

  const FileIcon = kind === "video" ? FileVideo : FileAudio;

  /* --- read duration locally, no upload involved --------------------
     Skipped entirely when the caller supplies it. A <video> element for
     video files: an <audio> element reads MP4 and MOV but returns
     Infinity or errors on MKV, AVI and some WEBM, so the duration line
     silently vanished on exactly the containers people drag in from a
     camera. */
  useEffect(() => {
    if (!ownsProbe) return;
    if (!currentFile) {
      setProbedDuration(null);
      return;
    }

    let released = false;
    const objectUrl = URL.createObjectURL(currentFile);
   const probe: HTMLMediaElement = document.createElement(kind === "video" ? "video" : "audio");
    const release = () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    };

    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setProbedDuration(probe.duration);
      release();
    };
    probe.onerror = () => {
      setProbedDuration(null);
      release();
    };
    probe.src = objectUrl;

    return () => {
      probe.onloadedmetadata = null;
      probe.onerror = null;
      release();
    };
  }, [currentFile, ownsProbe, kind]);

  /* --- drag handling, shared by both states -------------------------
     The selected-file card accepts drops too. Dragging a second file onto
     a form that already has one obviously means "use this one instead",
     and the old card just ignored it — the drop landed on the page and
     the browser tried to open the file. */
  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (disabled) return;
      dragDepth.current += 1;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelect(file);
    },
    [disabled, onFileSelect]
  );

  const dragHandlers = {
    onDragEnter: handleDragEnter,
    onDragOver: (e: DragEvent<HTMLElement>) => e.preventDefault(),
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // Reset so re-picking the same file still fires onChange.
    e.target.value = "";
  };

  // Rendered in both branches, so the selected-file card can offer
  // Replace without unmounting and remounting the input.
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      onChange={handleFileInput}
      disabled={disabled}
      className="hidden"
    />
  );

  /* --- selected file ------------------------------------------------ */
  if (currentFile) {
    return (
      <>
        {/* The swap from empty box to file card is silent for a screen
            reader — the button just stops existing. */}
        <p className="sr-only" role="status" aria-live="polite">
          {currentFile.name} selected
        </p>

        <div
          {...dragHandlers}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 transition-colors",
            isDragging
              ? "border-dashed border-amber-500/60 bg-amber-500/[0.06]"
              : invalid
                ? "border-red-500/40 bg-red-500/[0.05]"
                : "border-graphite-800 bg-graphite-850/60"
          )}
        >
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
              invalid
                ? "border-red-500/30 bg-red-500/10"
                : "border-graphite-700 bg-graphite-800"
            )}
          >
            {invalid ? (
              <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden />
            ) : (
              <FileIcon className="h-5 w-5 text-amber-500" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{currentFile.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
              {fileExtension(currentFile.name)} · {formatBytes(currentFile.size)}
              {duration !== null && duration !== undefined
                ? ` · ${formatDuration(duration)}`
                : ""}
            </p>
          </div>

          {/* Replace, not just Remove. Picking the wrong file is the common
              mistake, and clearing to an empty dropzone and starting over
              is two steps where one will do.

              Was `hidden sm:flex`, which left phone users — most of them —
              with only the destructive option. It's an icon under sm and
              gains its label above. */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            aria-label="Replace file"
            className="flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-xs text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40 sm:px-2"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Replace</span>
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            aria-label="Remove file"
            className="shrink-0 rounded-md p-1.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>

          {fileInput}
        </div>
      </>
    );
  }

  /* --- empty state --------------------------------------------------
     Solid border at rest, dashed only while something is over it. A
     permanently dashed box is the visual language of "nothing here yet",
     which is why the resting form looked unfinished.

     The tile is h-11, matching the selected-file card exactly — it was
     h-10, one notch off, so choosing a file nudged the icon by 4px and
     read as one component being swapped for another rather than this one
     changing state. Same reason the padding and radius now match. */
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        {...dragHandlers}
        className={cn(
          "group flex min-h-[7rem] w-full flex-col items-center justify-center gap-2.5 rounded-lg border px-4 py-6 text-center",
          "transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
          // 50, not 40: at 40 the disabled box read as broken rather than
          // unavailable.
          "disabled:cursor-not-allowed disabled:opacity-50",
          isDragging
            ? "border-dashed border-amber-500/60 bg-amber-500/[0.06]"
            : "border-graphite-800 bg-graphite-850/40 hover:border-graphite-700 hover:bg-graphite-850/70"
        )}
      >
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors",
            isDragging
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-graphite-700 bg-graphite-800 group-hover:border-amber-500/30"
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5 transition-colors",
              isDragging ? "text-amber-400" : "text-text-subtle group-hover:text-amber-500"
            )}
            aria-hidden
          />
        </span>

        <span>
          <span className="block text-sm text-text-primary">
            {isDragging ? (
              <span className="text-amber-400">Release to upload</span>
            ) : (
              <>
                Drop {kind === "video" ? "a video" : "an audio"} file, or{" "}
                <span className="text-amber-400 underline underline-offset-2">browse</span>
              </>
            )}
          </span>
          {/* Mono, matching the selected file's meta line — the same kind
              of information in the same voice. */}
          <span className="mt-1 block font-mono text-[11px] text-text-subtle">{resolvedHint}</span>
        </span>
      </button>

      {fileInput}
    </>
  );
}