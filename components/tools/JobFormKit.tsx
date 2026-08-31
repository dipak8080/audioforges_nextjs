"use client";

/**
 * components/tools/JobFormKit.tsx
 *
 * The parts every job form on the site shares.
 *
 * JobToolForm, MultiOutputToolForm and YouTubeUrlForm had each grown their own
 * copy of the same nine things — elapsed clock, cooldown ticker, retry
 * predicate, stage label resolution, progress curve, working panel, error
 * panel, result header, action bar. They had already drifted: two of the three
 * handled a 401 during polling, one didn't; one cleared `billing` on cancel,
 * two didn't; the header eyebrow was mono in two files and sans in the third.
 *
 * Anything in here is shared BEHAVIOUR or shared CHROME. Anything a tool
 * genuinely does differently — what it submits, what a result looks like, which
 * ceiling it polls against — stays in the form.
 */

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ApiError } from "@/lib/api/railway";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

/** A stage label that appears once `at` seconds have elapsed. */
export interface ProcessingStage {
  at: number;
  label: string;
}

/** Timings for one polling run. Carried through the recursion so an upgraded
 *  job cannot inherit the tier it was upgraded FROM. */
export interface PollTiming {
  intervalMs: number;
  maxMs: number;
}

export interface FormError {
  title: string;
  hint: string;
  /** Free-tier rate limit on a metered tool — an offer, not a dead end. */
  offerCredits?: boolean;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatCooldown(seconds: number): string {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
  return `${seconds}s`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Only conditions that mean "the server was too slow or too busy to answer".
 *  A genuinely invalid request would just fail again immediately. */
export function isRetryableSubmitError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  // status 0 = fetch itself failed (network blip / DNS hiccup)
  return error.isTimeout || error.isServerBusy || error.status === 0;
}

/**
 * A REJECTED poll is not a slow job.
 *
 * Anything that isn't a 404 used to fall through to "retry next tick", which is
 * right for a dropped connection and wrong for a response that will never
 * change: an auth failure repeats identically until the ceiling, then reports
 * "taking unusually long" on a job the server settled in about a minute. 401
 * and 403 mean this browser cannot read this job, and waiting doesn't fix that.
 *
 * Returns the error to show, or null to keep polling.
 */
export function terminalPollError(err: unknown): FormError | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status === 401 || err.status === 403) {
    return {
      title: "We lost track of this job",
      hint: "It may still be running on our servers. Reload the page — if a credit was taken and the run failed, it comes back automatically.",
    };
  }
  if (err.status === 404) {
    return {
      title: "This job expired",
      hint: "Results are held for a limited time. Start it again to re-run it.",
    };
  }
  return null;
}


/**
 * A FAILED job's message, as the server wrote it.
 *
 * ── WHY THIS EXISTS ──
 *
 * Confirmed against routes/_shared.py, the background runner every job tool
 * shares: an `AudioToolError` is caught and `str(e)` goes into `job["error"]`
 * unmodified, because those messages are written for the person who uploaded
 * the file. Only the bare `except Exception` fallback is generic.
 *
 * So EVERY status:"failed" carrying an error string is already user-facing
 * copy, and usually more specific than anything we could write: "This file
 * would split into 63 segments, which exceeds the 50 limit. Try raising the
 * silence threshold or minimum duration", "Audio is too long (35.2 min)", "No
 * silence detected".
 *
 * Five forms were running that through a local `humanizeError` that pattern-
 * matches on substrings and REPLACES it. A server message containing the word
 * "format" became "This file format isn't supported — convert it to WAV or MP3
 * first", discarding whatever the server actually said. On the silence-split
 * cap it discarded a message that named the real count and the fix, and
 * substituted advice to change the file — when the file was fine and the
 * setting was the problem.
 *
 * Render it verbatim. Our own copy is the FALLBACK, for the case where the
 * server sent nothing.
 */
export function serverFailure(
  message: string | null | undefined,
  fallback: FormError,
  hint = "Adjust the settings above and run it again."
): FormError {
  const text = message?.trim();
  if (!text) return fallback;
  return { title: text, hint };
}

/** Index of the stage currently running. -1 means "no stage list", which falls
 *  back to a single static processing label. */
export function stageIndexFor(stages: ProcessingStage[] | undefined, elapsed: number): number {
  if (!stages?.length) return -1;
  let index = 0;
  for (let i = 0; i < stages.length; i += 1) {
    if (elapsed >= stages[i].at) index = i;
  }
  return index;
}

/**
 * Eases toward 92% and only completes when the job actually does. `tau` is the
 * time constant in seconds — bigger for slow jobs, so the curve doesn't look
 * stuck near the end of a four-stem separation.
 */
export function easedProgress(elapsed: number, tau: number): number {
  return Math.min(92, Math.round((1 - Math.exp(-elapsed / tau)) * 100));
}

/** Ticks while `active`. One implementation, so the clock can't run at a
 *  different rate in one form than another. */
export function useElapsedSeconds(active: boolean): [number, (n: number) => void] {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return [seconds, setSeconds];
}

/** Counts down to zero. Returns the current value and a setter to arm it. */
export function useCooldownSeconds(): [number, (n: number) => void] {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  return [seconds, setSeconds];
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/**
 * Scoped to the job forms rather than globals.css: these animations exist for
 * the job lifecycle and nothing else, and a page that never mounts a form has
 * no reason to carry them. globals.css already neutralises all animation under
 * prefers-reduced-motion.
 */
const KIT_STYLES = `
@keyframes jt-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.jt-in { animation: jt-in .28s cubic-bezier(.22,.9,.32,1) both; }
@keyframes jt-sheen { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
.jt-sheen::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
  animation: jt-sheen 1.8s ease-in-out infinite;
}
@keyframes jt-ring { 0%,100% { opacity: .35; } 50% { opacity: .9; } }
.jt-ring { animation: jt-ring 1.6s ease-in-out infinite; }
`;

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

/**
 * Three segments, one per state of the run. Labels come from the form because
 * the first one differs — a file for the upload tools, a link for /youtube/* —
 * but the shape doesn't.
 */
function StepRail({
  steps,
  step,
  busy,
  failed,
}: {
  steps: readonly [string, string, string];
  step: 1 | 2 | 3;
  busy: boolean;
  failed: boolean;
}) {
  return (
    <ol className="mt-2.5 flex items-center gap-1.5">
      {steps.map((label, i) => {
        const index = i + 1;
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-0.5 w-full rounded-full transition-colors duration-300",
                failed && current
                  ? "bg-red-500/70"
                  : done
                    ? "bg-teal-500/60"
                    : current
                      ? "bg-amber-500"
                      : "bg-graphite-800"
              )}
              aria-hidden
            />
            {/* Active step is the brightest label. text-subtle/50 was
                ~2.3:1 against the surface, under the WCAG floor. */}
            <span
              className={cn(
                "text-[10px] uppercase tracking-[0.16em] transition-colors duration-300",
                current
                  ? "font-medium text-text-primary"
                  : done
                    ? "text-text-muted"
                    : "text-text-subtle"
              )}
            >
              {label}
              {current && busy && <span className="sr-only"> (in progress)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The card. Sections are separated by hairlines rather than by more vertical
 * space: the source, the tool's own controls and the progress panel used to sit
 * at the same level with nothing grouping them — a pile of widgets rather than
 * a panel with parts.
 */
export function FormShell({
  toolLabel,
  toolMeta,
  steps,
  step,
  busy,
  failed,
  complete,
  children,
  footer,
  allowOverflow = false,
}: {
  toolLabel: string;
  toolMeta?: string;
  steps: readonly [string, string, string];
  step: 1 | 2 | 3;
  busy: boolean;
  failed: boolean;
  complete: boolean;
  children: ReactNode;
  /** The primary action. Recessed and pinned to the bottom edge so it sits in
   *  the same place in every state, rather than being the last item in
   *  whichever stack happens to be rendered. */
  footer?: ReactNode;
  /**
   * Drops `overflow-hidden` from the card.
   *
   * The default clips children to the rounded corners, which is what you want
   * for every form whose content stays inside the card. It is WRONG for two
   * things, and both are in the transcription form:
   *
   *  · A POPOVER. SearchableSelect opens a ~99-item language list; clipped, it
   *    is cut off at the card edge and unusable.
   *  · A STICKY ELEMENT. `position: sticky` resolves against the nearest
   *    scrollable ancestor, and `overflow-hidden` makes the card one. The
   *    player in TranscriptView then sticks to a container that never scrolls
   *    — so it simply never moves, silently, with no error and nothing to see
   *    except a feature that quietly does nothing.
   *
   * With this set, the header and footer round themselves instead, so the card
   * still looks the same.
   */
  allowOverflow?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-graphite-800 bg-graphite-900 shadow-xl shadow-black/20",
        // See allowOverflow: clipping is right for every form EXCEPT the one
        // with a popover and a sticky player inside it.
        !allowOverflow && "overflow-hidden"
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: KIT_STYLES }} />

      <div
        className={cn(
          "border-b border-graphite-800 bg-graphite-900/80 px-5 pb-3 pt-3.5 sm:px-8",
          // Without the card's overflow-hidden, a square-cornered header paints
          // over the rounded border. It rounds itself instead.
          allowOverflow && "rounded-t-2xl"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "relative flex h-1.5 w-1.5 shrink-0 rounded-full",
                complete ? "bg-teal-400" : failed ? "bg-red-500" : "bg-amber-500"
              )}
              aria-hidden
            >
              {busy && (
                <span className="jt-ring absolute -inset-1 rounded-full border border-amber-500/60 motion-reduce:hidden" />
              )}
            </span>
            <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
              {toolLabel}
            </span>
          </div>
          {toolMeta && (
            <span className="shrink-0 font-mono text-[11px] text-text-subtle">{toolMeta}</span>
          )}
        </div>

        <StepRail steps={steps} step={step} busy={busy} failed={failed} />
      </div>

      <div className="divide-y divide-graphite-800">{children}</div>

      {footer && (
        <div
          className={cn(
            "border-t border-graphite-800 bg-graphite-950/40 p-4 sm:px-8 sm:py-5",
            allowOverflow && "rounded-b-2xl"
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

export function Section({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("p-5 sm:p-8", className)}>{children}</section>;
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

export function ValidationNote({ message }: { message: string }) {
  return (
    <div
      className="jt-in flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
      <span className="text-sm text-text-primary">{message}</span>
    </div>
  );
}

export function WorkingPanel({
  stageLabel,
  stages,
  stageIndex,
  showStageList,
  elapsedSeconds,
  progress,
  expectedRange,
  chargedRun,
  onCancel,
  waveform,
}: {
  stageLabel: string;
  stages?: ProcessingStage[];
  stageIndex: number;
  /** Stage list only while the job is really running — during upload there's
   *  nothing to tick off yet. */
  showStageList: boolean;
  elapsedSeconds: number;
  progress: number;
  expectedRange?: string;
  chargedRun: boolean;
  onCancel: () => void;
  waveform: ReactNode;
}) {
  return (
    <div
      className="jt-in space-y-3.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
          <Loader2
            className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500 motion-reduce:hidden"
            aria-hidden
          />
          <span className="truncate">{stageLabel}</span>
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>

      {/* The bar carries a moving sheen rather than only growing. The eased
          curve is honest but nearly motionless on a long job, which reads as
          frozen — and a four-stem HQ separation is the longest job here. */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Processing progress"
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-graphite-800"
      >
        <div
          className="jt-sheen relative h-full overflow-hidden rounded-full bg-amber-500 transition-[width] duration-1000 ease-out motion-reduce:transition-none motion-reduce:[&::after]:hidden"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Passed stages are ordered by elapsed time, so what's behind you gets a
          tick and what's ahead stays dim — the difference between "something is
          happening" and "this is where it is". */}
      {showStageList && stages && stages.length > 1 && (
        <ol className="space-y-1.5 border-t border-amber-500/10 pt-3">
          {stages.map((stage, i) => {
            const done = i < stageIndex;
            const current = i === stageIndex;
            return (
              <li
                key={`${stage.at}-${stage.label}`}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  done ? "text-text-muted" : current ? "text-text-primary" : "text-text-subtle/70"
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-teal-500/50 bg-teal-500/15"
                      : current
                        ? "border-amber-500 bg-amber-500/20"
                        : "border-graphite-700"
                  )}
                  aria-hidden
                >
                  {done && <Check className="h-2 w-2 text-teal-400" strokeWidth={3.5} />}
                  {current && <span className="h-1 w-1 rounded-full bg-amber-400" />}
                </span>
                <span className="truncate">{stage.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="opacity-60 motion-reduce:hidden">{waveform}</div>
        {/* Left as a plain button on purpose: this is an underlined text link,
            not a button shape. Running it through Button would mean overriding
            the padding, height, radius and every variant colour.

            The LABEL changes on a charged run because the behaviour is not what
            "Cancel" implies: this stops the poll, not the job, and the credit is
            already spent. Telling someone they can cancel and then taking both
            their credit and their result is the worst thing these forms can do. */}
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-1 text-xs text-text-subtle underline underline-offset-2 outline-none transition-colors hover:text-red-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          {chargedRun ? "Stop watching" : "Cancel"}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-text-subtle">
        {expectedRange ? `Typically ${expectedRange}. ` : ""}Keep this tab open.
        {chargedRun && " This run has already used its credit — stopping here won't return it."}
      </p>
    </div>
  );
}

export function ResultHeader({
  verb,
  title,
  meta,
  media,
  tag,
}: {
  verb: string;
  title: string;
  /** e.g. "Finished in 0:42". Omitted where the form has nothing to say. */
  meta?: string;
  /** Thumbnail or artwork, for the tools that have one. */
  media?: ReactNode;
  /** StudioQualityTag, on the tools that can run at HQ. */
  tag?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-4">
      {media ?? (
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-teal-500/40 bg-teal-500/15"
          aria-hidden
        >
          <Check className="h-3.5 w-3.5 text-teal-400" strokeWidth={3} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-400">{verb}</p>
          {tag}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-text-primary">{title}</p>
        {meta && <p className="mt-1 font-mono text-[11px] text-text-subtle">{meta}</p>}
      </div>
    </div>
  );
}

export function ErrorPanel({ error, children }: { error: FormError; children?: ReactNode }) {
  return (
    <div
      className="jt-in flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4"
      role="alert"
    >
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10"
        aria-hidden
      >
        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{error.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{error.hint}</p>
        {children}
      </div>
    </div>
  );
}

/** A countdown you can watch drain beats a number that only ticks down inside
 *  the button label. */
export function CooldownBar({ seconds, ceiling }: { seconds: number; ceiling: number }) {
  if (seconds <= 0) return null;
  return (
    <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-graphite-800" aria-hidden>
      <div
        className="h-full rounded-full bg-amber-500/60 transition-[width] duration-1000 ease-linear"
        style={{ width: `${Math.min(100, (seconds / ceiling) * 100)}%` }}
      />
    </div>
  );
}