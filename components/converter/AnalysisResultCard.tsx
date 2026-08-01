"use client";

import { useState } from "react";
import { Info, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AnalysisResult } from "@/lib/types/converter";

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

function ConfidenceMeter({ label, pct, disagrees }: { label: string; pct: number; disagrees: boolean }) {
  const tone = confidenceTone(pct);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <span className={cn("font-mono text-xs tabular-nums", tone.text)}>
          {tone.word} · {pct}%
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} />
      </div>
      {disagrees && (
        <p className="flex items-center gap-1 text-[11px] text-amber-400/90">
          <Info className="h-3 w-3 shrink-0" />
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
  const neighbours = camelotNeighbours(result.camelot);
  const alternatives = tempoAlternatives(result.bpm);

  const summary = `${result.key} · ${result.camelot} · ${result.bpm} BPM`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          className="mt-3 flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:border-graphite-700/60 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy key & BPM"}
        </button>
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
        <ConfidenceMeter label="Key detection" pct={result.confidence} disagrees={result.keyAgrees === false} />
        <ConfidenceMeter label="Tempo detection" pct={result.bpmConfidence} disagrees={result.bpmAgrees === false} />
      </div>
    </div>
  );
}