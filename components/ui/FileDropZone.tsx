"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Upload, FileAudio, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  currentFile: File | null;
  onClear: () => void;
  disabled?: boolean;
  accept?: string;
  /** Size cap in bytes. Used to build the default hint text. */
  maxSize?: number;
  /** Overrides the hint text entirely. Leave unset to have it derived
   * from `accept` (and `maxSize`, when given). */
  hint?: string;
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
 * Reads the format list off `accept` rather than hardcoding it.
 *
 * The old default was the literal string "MP3, WAV, FLAC, M4A, AAC, OGG"
 * regardless of what the file picker would actually allow - so a tool
 * passing a different `accept` (video-to-audio) had to remember to pass a
 * matching `hint` too, and any drift between the two was invisible until
 * a user was told their file was fine and then rejected. One source now.
 */
function formatsFromAccept(accept: string): string {
  const extensions = accept
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("."))
    .map((part) => part.slice(1).toUpperCase());

  // Capped at four. The full list runs to seven items, which stops being
  // information and becomes texture - nobody reads to the end of it, and
  // the ones that matter are the ones people actually have.
  if (extensions.length > 4) return `${extensions.slice(0, 4).join(", ")} and more`;
  if (extensions.length > 0) return extensions.join(", ");
  // Only wildcards given, e.g. "audio/*" — say the category instead.
  if (accept.includes("video")) return "Video files";
  return "Audio files";
}

export function FileDropZone({
  onFileSelect,
  currentFile,
  onClear,
  disabled,
  accept = "audio/*",
  maxSize,
  hint,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // dragleave fires when the pointer crosses a child element, which makes
  // the highlight flicker. Counting enters and leaves fixes it.
  const dragDepth = useRef(0);

  const resolvedHint =
    hint ??
    `${formatsFromAccept(accept)}${maxSize ? ` · up to ${Math.round(maxSize / (1024 * 1024))} MB` : ""}`;

  /* --- read duration locally, no upload involved -------------------- */
  useEffect(() => {
    if (!currentFile) {
      setDuration(null);
      return;
    }
    let released = false;
    const objectUrl = URL.createObjectURL(currentFile);
    const probe = new Audio();
    const release = () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    };

    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setDuration(probe.duration);
      release();
    };
    probe.onerror = () => {
      setDuration(null);
      release();
    };
    probe.src = objectUrl;

    return () => {
      probe.onloadedmetadata = null;
      probe.onerror = null;
      release();
    };
  }, [currentFile]);

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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // Reset so re-picking the same file still fires onChange.
    e.target.value = "";
  };

  // Rendered in both branches now, so the selected-file card can offer
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

  /* --- selected file: show what the tool is about to work on -------- */
  if (currentFile) {
    return (
      <div className="flex items-center gap-3.5 rounded-xl border border-graphite-800 bg-graphite-850/60 p-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-graphite-700 bg-graphite-800">
          <FileAudio className="h-5 w-5 text-amber-500" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{currentFile.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
            {fileExtension(currentFile.name)} · {formatBytes(currentFile.size)}
            {duration !== null ? ` · ${formatDuration(duration)}` : ""}
          </p>
        </div>

        {/* Replace, not just Remove. Picking the wrong file is the common
            mistake, and clearing to an empty dropzone and starting over
            is two steps where one will do - the X also resets any tool
            controls set since, which is rarely what's wanted. */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="hidden shrink-0 rounded-md px-2 py-1.5 text-xs text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40 sm:flex sm:items-center sm:gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Replace
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Remove file"
          className="shrink-0 rounded-md p-1.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {fileInput}
      </div>
    );
  }

  /* --- empty state --------------------------------------------------
     THE BORDER IS SOLID UNTIL YOU DRAG (2026-08-17).

     A permanently dashed box reads as a placeholder - the visual
     language of "nothing here yet", which is why the empty form looked
     unfinished rather than ready. Dashed is now reserved for the drag
     state, where it means something: "release here". Solid at rest,
     dashed and amber the moment a file is over it.

     Height came down from py-10 (~200px total) to py-8. It was the
     largest element on the page and most of it was empty. A drop target
     needs to be obvious, not enormous.

     The icon sits in the same 44px tile the selected-file card uses, so
     choosing a file reads as this element changing state rather than one
     component being swapped for a different one. */
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled) return;
          dragDepth.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "group flex w-full flex-col items-center justify-center gap-2.5 rounded-xl border px-4 py-6 text-center",
          "transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
          "disabled:cursor-not-allowed disabled:opacity-40",
          isDragging
            ? "border-dashed border-amber-500/60 bg-amber-500/[0.06]"
            : "border-graphite-800 bg-graphite-850/40 hover:border-graphite-700 hover:bg-graphite-850/70"
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
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
                Drop an audio file, or{" "}
                <span className="text-amber-400 underline underline-offset-2">browse</span>
              </>
            )}
          </span>
          {/* Mono, matching the selected file's meta line - the same kind
              of information in the same voice. */}
          <span className="mt-1 block font-mono text-[11px] text-text-subtle">{resolvedHint}</span>
        </span>
      </button>

      {fileInput}
    </>
  );
}