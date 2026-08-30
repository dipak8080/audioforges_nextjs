"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types/converter";

/* ------------------------------------------------------------------ */
/* Response mapping                                                     */
/* ------------------------------------------------------------------ */

/**
 * AnalyzeResponse → AnalysisResult.
 *
 * ── THIS PASS ──
 * KeyFinderForm and YouTubeAnalyzeForm each carried their own copy of this,
 * character for character: the same `toPct`, the same fallbacks, the same
 * `typeof … === "boolean"` guards on cross_check. Two copies of a mapping is
 * two places to fix when the backend adds a field, and the first symptom of
 * drift would be the same track reporting different confidence depending on
 * whether it was uploaded or pasted.
 *
 * It lives next to the component that consumes it, so a change to the shape
 * and a change to the rendering land in the same file.
 *
 * The percentage rule handles both conventions the backend has used: a 0–1
 * fraction and an already-scaled 0–100. `n > 1` picks between them, and a
 * clean 1.0 reads as 100% rather than 1% — which is the case that makes the
 * naive `n * 100` version wrong in the least visible way.
 */
export function toAnalysisResult(data: AnalyzeResponse): AnalysisResult {
  const toPct = (n: number) => Math.round(n > 1 ? n : n * 100);

  return {
    key: (data.key as string) || "Unknown",
    camelot: (data.camelot as string) || "N/A",
    bpm: Math.round(Number(data.bpm) || 0),
    confidence: toPct(Number(data.confidence) || 0),
    bpmConfidence: toPct(Number(data.bpm_confidence) || 0),
    keyAgrees:
      typeof data.cross_check?.key_agrees === "boolean" ? data.cross_check.key_agrees : null,
    bpmAgrees:
      typeof data.cross_check?.bpm_agrees === "boolean" ? data.cross_check.bpm_agrees : null,
  };
}

/* ------------------------------------------------------------------ */
/* Camelot helpers — pure client-side maths off the wheel               */
/* ------------------------------------------------------------------ */

/** Neighbours on the Camelot wheel: same number/other letter (relative
 *  major or minor) and ±1 around the ring. These are the mixes a DJ
 *  actually reaches for, which is why they're worth surfacing. */
function camelotNeighbours(code: string): string[] {
  const match = /^(\d{1,2})([AB])$/.exec(code.trim().toUpperCase());
  if (!match) return [];
  const number = Number(match[1]);
  const letter = match[2];
  if (number < 1 || number > 12) return [];

  const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;
  return [
    `${number}${letter === "A" ? "B" : "A"}`,
    `${wrap(number - 1)}${letter}`,
    `${wrap(number + 1)}${letter}`,
  ];
}

/** Detectors routinely land an octave off. Showing the halved and
 *  doubled tempo saves the "is this 70 or 140?" guess. */
function tempoAlternatives(bpm: number): number[] {
  if (!bpm) return [];
  const out: number[] = [];
  if (bpm / 2 >= 60) out.push(Math.round(bpm / 2));
  if (bpm * 2 <= 200) out.push(bpm * 2);
  return out;
}

function confidenceTone(pct: number): { bar: string; text: string; word: string } {
  if (pct >= 80) return { bar: "bg-teal-400", text: "text-teal-400", word: "Strong" };
  if (pct >= 55) return { bar: "bg-amber-500", text: "text-amber-400", word: "Fair" };
  return { bar: "bg-red-400", text: "text-red-400", word: "Weak" };
}

/* ------------------------------------------------------------------ */

function ConfidenceMeter({
  label,
  pct,
  disagrees,
}: {
  label: string;
  pct: number;
  disagrees: boolean;
}) {
  const tone = confidenceTone(pct);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <span className={cn("font-mono text-xs tabular-nums", tone.text)}>
          {tone.word} · {pct}%
        </span>
      </div>
      {/* The bar is decoration for the number beside it, which is why it
          carries progressbar semantics rather than being announced twice. */}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1 w-full overflow-hidden rounded-full bg-graphite-800"
      >
        <div
          className={cn("h-full rounded-full", tone.bar)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      {disagrees && (
        <p className="flex items-center gap-1 text-[11px] text-amber-400/90">
          <Info className="h-3 w-3 shrink-0" aria-hidden />
          Two detectors disagreed — check by ear before you commit
        </p>
      )}
    </div>
  );
}

/**
 * Shared across KeyFinderForm (file upload) and YouTubeAnalyzeForm
 * (paste a link) — both hit the same key/BPM analysis backend and
 * should never visually drift apart. Change the result presentation
 * here and both tools pick it up.
 */
export function AnalysisResultCard({ result }: { result: AnalysisResult }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const neighbours = camelotNeighbours(result.camelot);
  const alternatives = tempoAlternatives(result.bpm);

  const summary = `${result.key} · ${result.camelot} · ${result.bpm} BPM`;

  /* The "Copied" flag reverts on a timer, and the user can navigate away
     inside those two seconds — analysing another track unmounts this card.
     Without the cleanup that's a setState on an unmounted component. */
  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the values are on screen to read off.
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero readout: key and tempo, the two things you came for */}
      <div className="rounded-xl border border-graphite-800 bg-graphite-850 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Key</p>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="font-mono text-4xl font-bold leading-none tracking-tight text-amber-400">
                {result.key}
              </span>
              <span className="rounded-md border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 font-mono text-sm font-semibold text-teal-400">
                {result.camelot}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Tempo</p>
            <p className="mt-1 font-mono text-4xl font-bold leading-none tracking-tight text-text-primary">
              {result.bpm}
              <span className="ml-1.5 text-sm font-medium text-text-subtle">BPM</span>
            </p>
          </div>
        </div>

        {alternatives.length > 0 && (
          <p className="mt-3 border-t border-graphite-800 pt-3 font-mono text-[11px] text-text-subtle">
            Also reads as {alternatives.join(" or ")} BPM at half or double time
          </p>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted outline-none transition-colors hover:border-graphite-700/60 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-teal-400" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy key & BPM"}
        </button>
        {/* Announced separately: the button's own label changing is a visual
            cue, and a screen reader shouldn't have to re-focus it to notice. */}
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? `Copied ${summary}` : ""}
        </span>
      </div>

      {/* Signature: what this track mixes into */}
      {neighbours.length > 0 && (
        <div className="rounded-xl border border-graphite-800 bg-graphite-850 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Mixes well with</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {neighbours.map((code) => (
              <span
                key={code}
                className="rounded-md border border-graphite-700 bg-graphite-800/60 px-3 py-1.5 font-mono text-sm text-text-primary"
              >
                {code}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-subtle">
            Neighbouring Camelot codes share enough notes to blend without clashing.
          </p>
        </div>
      )}

      {/* How much to trust the numbers above */}
      <div className="space-y-4 rounded-xl border border-graphite-800 bg-graphite-850 p-5">
        <ConfidenceMeter
          label="Key detection"
          pct={result.confidence}
          disagrees={result.keyAgrees === false}
        />
        <ConfidenceMeter
          label="Tempo detection"
          pct={result.bpmConfidence}
          disagrees={result.bpmAgrees === false}
        />
      </div>
    </div>
  );
}