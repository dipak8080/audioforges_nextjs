"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Copy,
  Check,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  Clock,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { cn } from "@/lib/utils/cn";
import { languageName, type Transcript } from "@/lib/api/transcription";
import {
  TRANSCRIPT_FORMATS,
  downloadTranscript,
  formatSegmentTime,
  formatTranscriptDuration,
  countWords,
  countMatches,
  groupIntoParagraphs,
  toTxt,
} from "@/lib/utils/transcript";

/* ==================================================================== */
/* Layout contract                                                      */
/* ==================================================================== */
/**
 * ONE BOX, NOT FOUR.
 *
 * This used to render, inside the form card that already has a border:
 * a bordered teal success panel, a bordered sample note, a bordered
 * toolbar group, a bordered scroll area, and a grid of bordered buttons.
 * Five outlines nested in a sixth. Nothing was wrong with any one of
 * them and the whole thing looked like a settings screen.
 *
 * Now there is exactly one bordered surface — the transcript itself — and
 * everything else is a hairline rule or nothing at all:
 *
 *   meta strip        mono, no border, no fill
 *   player            only when there is local audio
 *   toolbar           view switch + search, sits on the surface's top edge
 *   ┌ transcript ───────────────────────────────────┐  ← the only box
 *   └───────────────────────────────────────────────┘
 *   exports           Copy, then the three downloads
 *
 * The teal "complete" panel is gone because the panel header above it
 * already carries a teal dot and the word Done. Saying it twice made the
 * result feel like it needed announcing.
 */

type ViewMode = "read" | "timestamps";

interface TranscriptViewProps {
  transcript: Transcript;
  title: string | null;
  /**
   * Audio to play alongside the transcript, or null when there is none.
   *
   * A URL rather than a File because the two sources differ: an upload
   * is an object URL owned by the parent, the sample demo is a static
   * asset under /public. Owning the object URL here would mean this
   * component couldn't render the sample at all.
   *
   * Null on YouTube jobs — there's no local audio and the transcription
   * API has no preview route, so click-to-seek is simply unavailable.
   */
  previewSrc: string | null;
  /** Renders a "this is a sample" note and its attribution. */
  sampleNote?: string;
}

/* ------------------------------------------------------------------ */
/* Scrolling                                                           */
/* ------------------------------------------------------------------ */

/**
 * Scrolls the transcript pane, not the document.
 *
 * `element.scrollIntoView()` walks every scrollable ancestor, so following
 * playback dragged the entire page along with it — you'd be reading the
 * FAQ, hit play, and the page would yank itself back up. Every jump here
 * is a `scrollTop` write on one known container.
 */
function scrollWithin(
  element: HTMLElement | null,
  container: HTMLElement | null,
  mode: "center" | "nearest"
) {
  if (!element || !container) return;

  const box = container.getBoundingClientRect();
  const item = element.getBoundingClientRect();

  if (mode === "nearest" && item.top >= box.top && item.bottom <= box.bottom) return;

  const delta =
    mode === "center"
      ? item.top - box.top - (box.height - item.height) / 2
      : item.top < box.top
        ? item.top - box.top - 24
        : item.bottom - box.bottom + 24;

  container.scrollBy({ top: delta, behavior: "smooth" });
}

/* ------------------------------------------------------------------ */
/* Search highlighting                                                 */
/* ------------------------------------------------------------------ */

/**
 * Marks every occurrence in place rather than filtering the list down to
 * matching rows.
 *
 * Filtering was the old behaviour and it's the wrong one for a
 * transcript: it destroys the surrounding context, which is usually the
 * reason someone searched. You look for a word to find the passage
 * around it, not to see the word on its own.
 *
 * `offset` is the running count of matches before this block, so every
 * mark on the page carries a globally unique index — that's what lets
 * "4 of 17" and the next/previous buttons refer to the same thing.
 */
function highlight(
  text: string,
  query: string,
  offset: number,
  activeIndex: number,
  activeRef: React.RefObject<HTMLElement | null>
): ReactNode {
  if (!query) return text;

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const nodes: ReactNode[] = [];

  let cursor = 0;
  let matchIndex = offset;

  for (;;) {
    const found = haystack.indexOf(needle, cursor);
    if (found === -1) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (found > cursor) nodes.push(text.slice(cursor, found));

    const isActive = matchIndex === activeIndex;
    nodes.push(
      <mark
        key={matchIndex}
        ref={isActive ? (activeRef as React.RefObject<HTMLElement>) : undefined}
        className={cn(
          "rounded px-0.5",
          isActive ? "bg-amber-500 text-graphite-950" : "bg-amber-500/25 text-text-primary"
        )}
      >
        {text.slice(found, found + needle.length)}
      </mark>
    );

    cursor = found + needle.length;
    matchIndex += 1;
  }

  return nodes;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function TranscriptView({
  transcript,
  title,
  previewSrc,
  sampleNote,
}: TranscriptViewProps) {
  const [view, setView] = useState<ViewMode>("read");
  const [query, setQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const seekRef = useRef<((seconds: number) => void) | null>(null);
  const activeMatchRef = useRef<HTMLElement | null>(null);
  const activeRowRef = useRef<HTMLElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const paragraphs = useMemo(() => groupIntoParagraphs(transcript.segments), [transcript.segments]);

  /* Match offsets, computed once per query so every block knows how many
     matches came before it. */
  const trimmedQuery = query.trim();

  const segmentOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const segment of transcript.segments) {
      offsets.push(running);
      running += countMatches(segment.text, trimmedQuery);
    }
    return offsets;
  }, [transcript.segments, trimmedQuery]);

  const paragraphOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const paragraph of paragraphs) {
      offsets.push(running);
      running += countMatches(paragraph.text, trimmedQuery);
    }
    return offsets;
  }, [paragraphs, trimmedQuery]);

  const matchTotal = useMemo(
    () => countMatches(transcript.segments.map((s) => s.text).join(" "), trimmedQuery),
    [transcript.segments, trimmedQuery]
  );

  // A new search starts from the first hit rather than wherever the last
  // one left off.
  useEffect(() => {
    setActiveMatch(0);
  }, [trimmedQuery]);

  useEffect(() => {
    if (!trimmedQuery) return;
    scrollWithin(activeMatchRef.current, scrollAreaRef.current, "center");
  }, [activeMatch, trimmedQuery, view]);

  const activeSegment = useMemo(
    () =>
      transcript.segments.findIndex(
        (segment) => currentTime >= segment.start && currentTime < segment.end
      ),
    [transcript.segments, currentTime]
  );

  // Following playback fights with reading search results, so it yields
  // while a search is open.
  useEffect(() => {
    if (trimmedQuery || activeSegment < 0) return;
    scrollWithin(activeRowRef.current, scrollAreaRef.current, "nearest");
  }, [activeSegment, trimmedQuery]);

  /* `/` focuses the search field, the way it does in every tool built for
     people who read a lot of text. Guarded so it only fires when you're
     not already typing somewhere. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toTxt(transcript));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the text is on screen to select by hand.
    }
  };

  const stepMatch = useCallback(
    (delta: number) => {
      if (matchTotal === 0) return;
      setActiveMatch((current) => (current + delta + matchTotal) % matchTotal);
    },
    [matchTotal]
  );

  /* Confidence is meaningless when the language was pinned: the API
     hardcodes 1.0 in that case, so showing "100%" would be inventing a
     quality signal out of a constant. */
  const showConfidence = !transcript.language_forced;
  const confidence = Math.round(transcript.language_probability * 100);
  const canSeek = Boolean(previewSrc);

  const meta = [
    languageName(transcript.language),
    showConfidence ? `${confidence}% detection confidence` : "language specified",
    formatTranscriptDuration(transcript.duration),
    `~${countWords(transcript.text).toLocaleString()} words`,
  ];

  return (
    <div className="space-y-4">
      {/* ---------- Meta strip ----------
          A line of facts, not a status panel. The card header already
          says Done in teal; repeating it here in a bordered box was the
          outermost of the four nested outlines this component used to
          render. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {title || "Transcript"}
          </p>
          <p className="mt-1 font-mono text-[11px] text-text-subtle">{meta.join(" · ")}</p>
        </div>
        {transcript.task === "translate" && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-400">
            Translated
          </span>
        )}
      </div>

      {sampleNote && (
        <p className="border-l-2 border-amber-500/40 pl-3 text-[13px] leading-relaxed text-text-subtle">
          <span className="font-medium text-text-primary">This is a sample.</span> {sampleNote}
        </p>
      )}

      {/* Player sticks to the top of the viewport while the transcript
          scrolls under it. On anything longer than a couple of minutes
          you're otherwise scrolled away from the transport with no way to
          pause without scrolling back. */}
      {previewSrc && (
        <div className="sticky top-2 z-20">
          <AudioPlayer
            src={previewSrc}
            title={title ?? undefined}
            onTimeUpdate={setCurrentTime}
            seekRef={seekRef}
            className="shadow-lg shadow-graphite-950/60"
          />
        </div>
      )}

      {/* ---------- The one box ----------
          Toolbar and transcript share a single border, so the controls
          read as belonging to the pane they control rather than floating
          above it. */}
      <div className="overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850">
        <div className="flex flex-col gap-2 border-b border-graphite-800 p-2 sm:flex-row sm:items-center">
          <div
            role="group"
            aria-label="Transcript view"
            className="flex shrink-0 rounded-md bg-graphite-900 p-0.5"
          >
            {(
              [
                { value: "read", label: "Read", icon: AlignLeft },
                { value: "timestamps", label: "Timestamps", icon: Clock },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  aria-pressed={view === option.value}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                    view === option.value
                      ? "bg-amber-500/12 text-amber-400"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setQuery("");
                  e.currentTarget.blur();
                  return;
                }
                if (e.key !== "Enter") return;
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              }}
              placeholder="Search the transcript"
              aria-label="Search the transcript"
              className={cn(
                "h-9 w-full rounded-md border border-graphite-700 bg-graphite-900 pl-9 text-[13px] text-text-primary",
                "placeholder:text-text-subtle transition-colors",
                "focus:outline-none focus-visible:border-amber-500/40 focus-visible:ring-2 focus-visible:ring-amber-500/20",
                // Padding tracks what's actually rendered on the right,
                // instead of reserving room for controls that aren't
                // there yet.
                trimmedQuery ? "pr-[7.5rem]" : "pr-9"
              )}
            />

            {/* The affordance for the shortcut, in the place the shortcut
                acts on. Hidden on touch, where there's no key to press. */}
            {!query && (
              <kbd
                aria-hidden
                className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-graphite-700 px-1.5 py-0.5 font-mono text-[10px] text-text-subtle sm:block"
              >
                /
              </kbd>
            )}

            {trimmedQuery && (
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                <span
                  className={cn(
                    "px-1 font-mono text-[11px] tabular-nums",
                    matchTotal ? "text-text-muted" : "text-text-subtle"
                  )}
                >
                  {matchTotal ? `${activeMatch + 1}/${matchTotal}` : "0"}
                </span>
                <button
                  type="button"
                  onClick={() => stepMatch(-1)}
                  disabled={matchTotal === 0}
                  aria-label="Previous match"
                  className="rounded p-1 text-text-subtle transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => stepMatch(1)}
                  disabled={matchTotal === 0}
                  aria-label="Next match"
                  className="rounded p-1 text-text-subtle transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="rounded p-1 text-text-subtle transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Announced once per search rather than per keystroke, and kept
            out of the input's own label so it doesn't get re-read every
            time the field is focused. */}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic>
          {trimmedQuery
            ? matchTotal
              ? `${matchTotal} matches, showing ${activeMatch + 1}`
              : "No matches"
            : ""}
        </p>

        <div
          ref={scrollAreaRef}
          // overscroll-contain: hitting the bottom of the transcript
          // shouldn't hand the scroll to the page and throw the reader
          // down to the FAQ.
          className="scrollbar-thin max-h-[30rem] overflow-y-auto overscroll-contain p-3"
        >
          {view === "read" ? (
            /* TIMESTAMPS HANG IN THE MARGIN, NOT IN THE SENTENCE.
             *
             * They used to sit inline as the first thing in each
             * paragraph, which put a monospaced number in the middle of
             * running prose and broke the one thing this view is for.
             * Reading view should read.
             *
             * Deleting them outright was the other option and it's
             * worse: click-to-seek would only exist in Timestamps view,
             * so anyone reading along would have to switch views to hear
             * a line. Hanging them in a gutter keeps the affordance and
             * gives the prose a clean left edge — the same thing every
             * transcript reader does with speaker names.
             *
             * The paragraph stays a <p>, not a button: people select and
             * copy transcript text, and dragging a selection across a
             * button is miserable.
             *
             * Below sm there's no room for a gutter, so the timestamps
             * are dropped and the view is pure prose. Timestamps view is
             * one tap away and is the better tool on a phone anyway.
             */
            <div className={cn("space-y-4", canSeek && "sm:pl-16")}>
              {paragraphs.map((paragraph, index) => {
                const isActive =
                  activeSegment >= 0 && paragraph.segmentIndices.includes(activeSegment);

                return (
                  <div key={index} className="group relative">
                    {canSeek && (
                      <button
                        type="button"
                        onClick={() => seekRef.current?.(paragraph.start)}
                        aria-label={`Play from ${formatSegmentTime(paragraph.start)}`}
                        title="Play from here"
                        className={cn(
                          "absolute -left-16 top-[0.35rem] hidden rounded px-1 font-mono text-[11px] tabular-nums transition-colors sm:block",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                          isActive
                            ? "text-amber-400"
                            : "text-text-subtle group-hover:text-text-muted hover:!text-amber-400"
                        )}
                      >
                        {formatSegmentTime(paragraph.start)}
                      </button>
                    )}

                    <p
                      ref={
                        isActive && !trimmedQuery
                          ? (activeRowRef as React.RefObject<HTMLParagraphElement>)
                          : undefined
                      }
                      className={cn(
                        "text-[15px] leading-[1.75] transition-colors",
                        isActive ? "text-text-primary" : "text-text-muted"
                      )}
                    >
                      {highlight(
                        paragraph.text,
                        trimmedQuery,
                        paragraphOffsets[index],
                        activeMatch,
                        activeMatchRef
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-0.5">
              {transcript.segments.map((segment, index) => {
                const isActive = index === activeSegment;

                return (
                  <button
                    key={index}
                    ref={
                      isActive && !trimmedQuery
                        ? (activeRowRef as React.RefObject<HTMLButtonElement>)
                        : undefined
                    }
                    type="button"
                    disabled={!canSeek}
                    onClick={() => seekRef.current?.(segment.start)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                      canSeek ? "cursor-pointer" : "cursor-default",
                      isActive ? "bg-amber-500/10" : canSeek && "hover:bg-graphite-800/60"
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 pt-0.5 font-mono text-[11px] tabular-nums",
                        isActive ? "text-amber-400" : "text-text-subtle"
                      )}
                    >
                      {formatSegmentTime(segment.start)}
                    </span>
                    <span
                      className={cn(
                        "text-sm leading-relaxed",
                        isActive ? "text-text-primary" : "text-text-muted"
                      )}
                    >
                      {highlight(
                        segment.text.trim(),
                        trimmedQuery,
                        segmentOffsets[index],
                        activeMatch,
                        activeMatchRef
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Exports ----------
          Four identical outline buttons in a 4-up grid gave Copy, TXT, SRT
          and VTT the same weight, so the row read as a toolbar of equals
          when it's really one common action and three file formats.
          Copy gets the fill; the formats get a segmented shell and a
          label saying what they are. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" size="md" onClick={handleCopy} className="sm:w-auto">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy text"}
        </Button>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle sm:flex">
            <Download className="h-3 w-3" aria-hidden />
            Download
          </span>
          <div
            role="group"
            aria-label="Download the transcript"
            className="flex flex-1 gap-1 rounded-lg border border-graphite-700 bg-graphite-850 p-1"
          >
            {TRANSCRIPT_FORMATS.map((format) => (
              <button
                key={format.value}
                type="button"
                title={format.hint}
                onClick={() => downloadTranscript(transcript, format.value, title)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 font-mono text-[13px] font-medium text-text-muted transition-colors",
                  "hover:bg-graphite-800 hover:text-text-primary",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                )}
              >
                {format.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}