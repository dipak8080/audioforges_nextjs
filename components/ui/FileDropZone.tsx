"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Upload, FileAudio, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  currentFile: File | null;
  onClear: () => void;
  disabled?: boolean;
  accept?: string;
  /** Size cap in bytes. Used to build the default hint text. */
  maxSize?: number;
  /** Overrides the hint text shown under the upload prompt. Defaults to
   * the audio-format hint since every tool but video-to-audio uploads
   * audio. */
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
    `MP3, WAV, FLAC, M4A, AAC, OGG${maxSize ? ` — up to ${Math.round(maxSize / (1024 * 1024))}MB` : ""}`;

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

  /* --- selected file: show what the tool is about to work on -------- */
  if (currentFile) {
    return (
      <div className="flex items-center gap-3.5 rounded-lg border border-graphite-800 bg-graphite-850/60 p-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-graphite-700 bg-graphite-800">
          <FileAudio className="h-5 w-5 text-amber-500" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{currentFile.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
            {fileExtension(currentFile.name)} · {formatBytes(currentFile.size)}
            {duration !== null ? ` · ${formatDuration(duration)}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Remove file"
          className="shrink-0 rounded-md p-1.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* --- empty state -------------------------------------------------- */
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
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
          "disabled:cursor-not-allowed disabled:opacity-40",
          isDragging
            ? "border-amber-500/60 bg-amber-500/5"
            : "border-graphite-700 hover:border-graphite-700/80 hover:bg-graphite-850/40"
        )}
      >
        <Upload
          className={cn(
            "h-6 w-6 transition-colors",
            isDragging ? "text-amber-500" : "text-text-subtle"
          )}
          aria-hidden
        />
        <p className="text-sm text-text-muted">
          {isDragging ? (
            <span className="text-amber-400">Drop to upload</span>
          ) : (
            <>
              <span className="text-amber-400">Click to upload</span> or drag and drop
            </>
          )}
        </p>
        <p className="text-xs text-text-subtle">{resolvedHint}</p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        disabled={disabled}
        className="hidden"
      />
    </>
  );
}