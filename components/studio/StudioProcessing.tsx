"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PeaksBars } from "./PeaksBars";
import { cn } from "@/lib/utils/cn";
import { formatDuration } from "@/lib/studio/local-audio";
import { estimateSeconds, expectedStems, type StudioEngine } from "@/lib/studio/run";
import type { StudioSelection } from "@/lib/studio/presets";
import type { RunAnalysis, RunPhase } from "@/lib/studio/use-studio-run";

function useNow(active: boolean, ms = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

function progressOf(elapsed: number, estimate: number): number {
  if (estimate <= 0) return 0;
  if (elapsed <= estimate) return 0.92 * (elapsed / estimate);
  return 0.92 + 0.06 * (1 - Math.exp(-(elapsed - estimate) / estimate));
}

export function StudioProcessing({
  phase,
  engine,
  selection,
  title,
  peaks,
  trackSeconds,
  analysis,
  startedAt,
  onCancel,
}: {
  phase: RunPhase;
  engine: StudioEngine;
  selection: StudioSelection;
  title: string;
  peaks: number[] | null;
  trackSeconds: number | null;
  analysis: RunAnalysis | null;
  startedAt: number;
  onCancel: () => void;
}) {
  const { t, plural } = useI18n();
  const r = t.run;
  const now = useNow(true);
  const uploading = phase === "submitting";
  const estimate = estimateSeconds(engine, selection, trackSeconds);
  const elapsed = uploading ? 0 : Math.max(0, (now - startedAt) / 1000 - 2);
  const progress = uploading ? 0 : progressOf(elapsed, estimate);
  const remaining = Math.max(0, Math.round(estimate - elapsed));
  const stems = expectedStems(selection, engine);
  const studio = engine === "studio";
  const analyzed = !!analysis || progress > 0.2;
  const finalizing = progress >= 0.9;

  const stage = uploading ? r.uploading : !analyzed ? r.listening : finalizing ? r.finalizing : r.separating;
  const eta = uploading
    ? ""
    : remaining <= 5
      ? r.almostDone
      : remaining >= 90
        ? plural(Math.round(remaining / 60), r.minutesLeft)
        : plural(remaining, r.secondsLeft);

  const steps = [
    { label: r.stepUpload, done: !uploading, active: uploading },
    { label: r.stepAnalyze, done: !uploading && analyzed, active: !uploading && !analyzed },
    { label: r.stepSeparate, done: finalizing, active: analyzed && !finalizing },
    { label: r.stepFinalize, done: false, active: finalizing },
  ];

  const tag = [analysis?.camelot, analysis?.bpm ? `${analysis.bpm} BPM` : null].filter(Boolean).join(" · ");

  return (
    <section className="surface grain relative overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite-800 px-5 py-3.5">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full motion-safe:animate-pulse",
              studio ? "bg-amber-500 shadow-[0_0_8px_rgba(232,162,61,0.7)]" : "bg-text-muted"
            )}
          />
          {studio ? t.panel.engine : t.panel.freeEngine}
        </span>
        <span className="font-mono text-[11px] text-text-muted" aria-live="polite">
          {eta}
        </span>
      </header>

      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="display truncate text-3xl text-text-primary md:text-4xl">{stage}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-text-muted">
              {title}
              {trackSeconds ? ` · ${formatDuration(trackSeconds)}` : ""}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-xs tracking-wider transition-opacity duration-500",
              tag ? "border-amber-500/40 text-amber-400 opacity-100" : "border-transparent opacity-0"
            )}
          >
            {tag || "·"}
          </span>
        </div>

        <div className="relative mt-5 h-24 overflow-hidden rounded-lg bg-graphite-950/60">
          {peaks ? (
            <>
              <PeaksBars peaks={peaks} className="absolute inset-0 px-1 opacity-35" />
              <div
                className="absolute inset-0 px-1 transition-[clip-path] duration-500 ease-linear"
                style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }}
              >
                <PeaksBars peaks={peaks} tone={studio ? "amber" : "neutral"} animate={false} />
              </div>
            </>
          ) : (
            <div
              className={cn("absolute inset-y-0 left-0 transition-[width] duration-500", studio ? "bg-amber-500/15" : "bg-graphite-700/40")}
              style={{ width: `${progress * 100}%` }}
            />
          )}
          <div
            className={cn("absolute inset-y-0 w-px transition-[left] duration-500 ease-linear", studio ? "bg-amber-400" : "bg-text-muted")}
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <ul className="mt-5 grid gap-1.5 sm:grid-cols-2">
          {stems.map((stem, i) => {
            const lit = !uploading && progress >= ((i + 1) / (stems.length + 1)) * 0.9;
            return (
              <li
                key={stem}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-500",
                  lit ? (studio ? "border-amber-500/30 bg-amber-500/[0.05]" : "border-graphite-600 bg-graphite-850") : "border-graphite-800"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-500",
                    lit ? (studio ? "bg-amber-400" : "bg-text-primary") : "bg-graphite-700"
                  )}
                />
                <span className={cn("text-sm transition-colors duration-500", lit ? "text-text-primary" : "text-text-subtle")}>
                  {r.stems[stem as keyof typeof r.stems] ?? stem}
                </span>
                <span className="relative ml-auto h-1 w-16 overflow-hidden rounded-full bg-graphite-800">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700",
                      studio ? "bg-amber-500" : "bg-text-muted",
                      lit && !finalizing && "motion-safe:animate-pulse"
                    )}
                    style={{ width: lit ? "100%" : "0%" }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="flex flex-col gap-3 border-t border-graphite-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
          {steps.map((s) => (
            <li
              key={s.label}
              className={cn(
                "flex items-center gap-1.5",
                s.done ? "text-text-body" : s.active ? (studio ? "text-amber-400" : "text-text-primary") : "text-text-subtle"
              )}
            >
              {s.done ? (
                <Check className="h-3 w-3" />
              ) : s.active ? (
                <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
              ) : (
                <span className="h-3 w-3 text-center">·</span>
              )}
              {s.label}
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-text-subtle">{studio ? r.refundNote : t.panel.freeQueue}</span>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {r.cancel}
          </Button>
        </div>
      </footer>
    </section>
  );
}