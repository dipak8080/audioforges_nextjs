"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Music2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { transformBuffer } from "@/lib/audio/stretch";
import { encodeWav } from "@/lib/audio/mix-export";

export interface PracticeStem {
  name: string;
  url: string;
  downloadName?: string;
}

type Setting = { tempo: number; semis: number };

export function usePractice(stems: PracticeStem[]) {
  const [draft, setDraft] = useState<Setting>({ tempo: 1, semis: 0 });
  const [applied, setApplied] = useState<Setting>({ tempo: 1, semis: 0 });
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const urlsRef = useRef<string[]>([]);
  const token = useRef(0);

  const clear = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  const apply = useCallback(async () => {
    const run = ++token.current;
    if (draft.tempo === 1 && draft.semis === 0) {
      clear();
      setUrls(null);
      setApplied(draft);
      return;
    }
    setProgress({ done: 0, total: stems.length });
    const ctx = new AudioContext();
    const next: Record<string, string> = {};
    const made: string[] = [];
    try {
      for (let i = 0; i < stems.length; i++) {
        const res = await fetch(stems[i].url);
        const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        const out = await transformBuffer(ctx, buffer, draft.tempo, draft.semis);
        const url = URL.createObjectURL(encodeWav(out));
        made.push(url);
        next[stems[i].name] = url;
        if (token.current !== run) break;
        setProgress({ done: i + 1, total: stems.length });
      }
    } finally {
      void ctx.close().catch(() => {});
    }
    if (token.current !== run) {
      made.forEach((u) => URL.revokeObjectURL(u));
      return;
    }
    clear();
    urlsRef.current = made;
    setUrls(next);
    setApplied(draft);
    setProgress(null);
  }, [clear, draft, stems]);

  const reset = useCallback(() => {
    token.current++;
    clear();
    setUrls(null);
    setProgress(null);
    setDraft({ tempo: 1, semis: 0 });
    setApplied({ tempo: 1, semis: 0 });
  }, [clear]);

  const effective = useMemo(
    () =>
      stems.map((s) =>
        urls?.[s.name] ? { ...s, url: urls[s.name], downloadName: s.downloadName?.replace(/\.[a-z0-9]+$/i, "-practice.wav") } : s
      ),
    [stems, urls]
  );

  const key = `${applied.tempo}|${applied.semis}|${urls ? Object.values(urls).join(",") : "orig"}`;
  return { draft, setDraft, applied, apply, reset, progress, stems: effective, mixerKey: key };
}

export function PracticeBar({ practice }: { practice: ReturnType<typeof usePractice> }) {
  const { t, fill, plural } = useI18n();
  const p = t.practice;
  const { draft, setDraft, applied, apply, reset, progress } = practice;
  const dirty = draft.tempo !== applied.tempo || draft.semis !== applied.semis;
  const changed = applied.tempo !== 1 || applied.semis !== 0;
  const semisLabel = draft.semis === 0 ? p.original : `${draft.semis > 0 ? "+" : "−"}${plural(Math.abs(draft.semis), p.semis)}`;

  return (
    <div className="surface rounded-xl border border-graphite-800 bg-graphite-900 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">{p.title}</span>
        <label className="flex min-w-[220px] flex-1 items-center gap-3">
          <Gauge className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="w-16 shrink-0 text-sm text-text-body">{p.tempo}</span>
          <input
            type="range"
            min={50}
            max={125}
            step={5}
            value={Math.round(draft.tempo * 100)}
            onChange={(e) => setDraft({ ...draft, tempo: Number(e.target.value) / 100 })}
            disabled={!!progress}
            className="flex-1 accent-amber-500"
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-text-primary">{Math.round(draft.tempo * 100)}%</span>
        </label>
        <label className="flex min-w-[220px] flex-1 items-center gap-3">
          <Music2 className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="w-16 shrink-0 text-sm text-text-body">{p.key}</span>
          <input
            type="range"
            min={-6}
            max={6}
            step={1}
            value={draft.semis}
            onChange={(e) => setDraft({ ...draft, semis: Number(e.target.value) })}
            disabled={!!progress}
            className="flex-1 accent-amber-500"
          />
          <span className="w-28 shrink-0 text-right font-mono text-xs text-text-primary">{semisLabel}</span>
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="accent" onClick={() => void apply()} disabled={!dirty || !!progress} loading={!!progress}>
            {p.apply}
          </Button>
          {changed && (
            <Button size="sm" variant="ghost" onClick={reset} disabled={!!progress}>
              <RotateCcw />
              {p.reset}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 font-mono text-[11px] text-text-subtle">
        {progress ? fill(p.working, { done: progress.done, total: progress.total }) : p.note}
      </p>
    </div>
  );
}