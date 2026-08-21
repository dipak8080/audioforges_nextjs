"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FileDropOverlayProps {
  onFile: (file: File) => void;
  /** Suppresses the overlay entirely — while a job runs, or once a
   *  result is on screen and a stray drop would discard it. */
  disabled?: boolean;
  /** Shown inside the overlay, e.g. "MP3, WAV, FLAC, M4A". Purely
   *  informational; the browser's own file dialog does the filtering. */
  hint?: string;
  label?: string;
}

/**
 * Makes the whole window a drop target, not just the dashed box.
 *
 * Dragging a file from a folder onto a page and having only a 200px
 * rectangle respond is a small, constant annoyance — people aim at the
 * page, not at the widget. Every desktop app that accepts files lights
 * up its entire window, and the expectation carries over.
 *
 * Reusable across every upload form on the site, not just transcription.
 *
 * Three details this gets right that a naive version doesn't:
 *
 *   1. dragenter and dragleave fire for EVERY nested element the cursor
 *      crosses, so tracking a boolean makes the overlay strobe as you
 *      move. A depth counter is the standard fix.
 *   2. dragover must preventDefault or the browser navigates to the file
 *      instead of firing drop — the failure mode where your page
 *      vanishes and an MP3 starts playing in a blank tab.
 *   3. Dragging selected text also fires these events. Checking for
 *      "Files" in dataTransfer.types keeps the overlay from appearing
 *      when someone drags a word across the page.
 */
export function FileDropOverlay({
  onFile,
  disabled = false,
  hint,
  label = "Drop your file anywhere",
}: FileDropOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const depthRef = useRef(0);

  const reset = useCallback(() => {
    depthRef.current = 0;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (disabled) {
      reset();
      return;
    }

    const carriesFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depthRef.current += 1;
      setIsDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      // Without this the browser opens the file instead of dropping it.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setIsDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      reset();
      const file = event.dataTransfer?.files?.[0];
      if (file) onFile(file);
    };

    // Dragging out of the window entirely fires neither dragleave nor
    // drop in some browsers, stranding the overlay on screen.
    const onWindowLeave = () => reset();

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("blur", onWindowLeave);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("blur", onWindowLeave);
    };
  }, [disabled, onFile, reset]);

  if (!isDragging) return null;

  return (
    <div
      // Not announced: a drag is a pointer gesture, and a live region
      // firing mid-drag interrupts a screen-reader user who is using the
      // file input rather than dragging anything.
      aria-hidden
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-6",
        "bg-graphite-950/80 backdrop-blur-sm"
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-amber-500/50 bg-graphite-900/90 px-8 py-12 text-center">
        <Upload className="h-8 w-8 text-amber-500" />
        <p className="text-lg font-medium text-text-primary">{label}</p>
        {hint && <p className="font-mono text-xs text-text-subtle">{hint}</p>}
      </div>
    </div>
  );
}