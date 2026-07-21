"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { Upload, FileAudio, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  currentFile: File | null;
  onClear: () => void;
  disabled?: boolean;
  accept?: string;
  maxSize?: number;
}

export function FileDropZone({
  onFileSelect,
  currentFile,
  onClear,
  disabled,
  accept = "audio/*",
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
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
    e.target.value = "";
  };

  if (currentFile) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-graphite-700 bg-graphite-850 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileAudio className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="text-sm text-text-primary truncate">{currentFile.name}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="text-text-muted hover:text-text-primary disabled:opacity-40 shrink-0"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center cursor-pointer transition-colors",
        disabled && "opacity-40 cursor-not-allowed",
        isDragging ? "border-amber-500/60 bg-amber-500/5" : "border-graphite-700 hover:border-graphite-700/80"
      )}
    >
      <Upload className="h-6 w-6 text-text-subtle" />
      <p className="text-sm text-text-muted">
        <span className="text-amber-400">Click to upload</span> or drag and drop
      </p>
      <p className="text-xs text-text-subtle">MP3, WAV, FLAC, M4A, AAC, OGG — up to 50MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}