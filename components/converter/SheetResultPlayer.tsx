"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, Square } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToneModule = typeof import("tone");
type OSMD = import("opensheetmusicdisplay").OpenSheetMusicDisplay;

type ScoreEvent = { tick: number; durTicks: number; pitches: number[]; velocity: number };

type Engine = {
  Tone: ToneModule;
  transport: ReturnType<ToneModule["getTransport"]>;
  synth: { releaseAll: () => void; dispose: () => void };
  part: { dispose: () => void };
  nodes: { dispose: () => void }[];
};

const PPQ = 480;
const MIN_NOTE_SEC = 0.04;

const fmtTime = (s: number) => {
  const x = Math.max(0, Math.floor(s));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
};

/**
 * Both the audio and the cursor are driven from OSMD's parsed score — never
 * from the job's MIDI file, which is the raw (unquantized) transcription and
 * would drift against the engraved timeline.
 */
export function SheetResultPlayer({
  musicXmlUrl,
  tempoBpm,
  fallback,
}: {
  musicXmlUrl: string;
  tempoBpm: number;
  fallback: React.ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempoPct, setTempoPct] = useState(100);
  const [loop, setLoop] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  const osmdRef = useRef<OSMD | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const eventsRef = useRef<ScoreEvent[]>([]);
  const stepsRef = useRef<number[]>([]);
  const stepIndexRef = useRef(0);
  const durationTicksRef = useRef(1);
  const posRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const tempoRef = useRef(100);
  const seekingRef = useRef(false);
  const litRef = useRef<{ el: SVGElement | HTMLElement }[]>([]);
  const baseBpmRef = useRef(Math.min(400, Math.max(20, tempoBpm || 120)));
  const [baseBpm, setBaseBpm] = useState(baseBpmRef.current);

  loopRef.current = loop;

  /* tempoBpm arrives from a separate fetch after mount — apply it live. */
  useEffect(() => {
    const clamped = Math.min(400, Math.max(20, tempoBpm || 120));
    if (clamped === baseBpmRef.current) return;
    baseBpmRef.current = clamped;
    setBaseBpm(clamped);
    const eng = engineRef.current;
    if (eng) eng.transport.bpm.value = clamped * (tempoRef.current / 100);
    syncTimeUi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempoBpm]);

  /* ---------- load, render, extract timeline ---------- */
  useEffect(() => {
    let alive = true;
    let osmd: OSMD | null = null;
    (async () => {
      try {
        const res = await fetch(musicXmlUrl);
        if (!res.ok) throw new Error(String(res.status));
        const xml = await res.text();
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (!alive || !hostRef.current) return;

        osmd = new OpenSheetMusicDisplay(hostRef.current, {
          autoResize: false,
          backend: "svg",
          drawTitle: false,
          drawComposer: false,
          drawLyricist: false,
          drawPartNames: false,
          followCursor: false,
          cursorsOptions: [{ type: 0, color: "#f59e0b", alpha: 0.45, follow: false }],
        });
        await osmd.load(xml);
        if (!alive) return;
        osmd.render();
        osmd.cursor.show();
        osmd.cursor.reset();
        styleCursor(osmd);

        /* One pass over the score: playback events + cursor step timeline. */
        const events = new Map<number, ScoreEvent>();
        const steps: number[] = [];
        const it = osmd.cursor.Iterator;
        let guard = 500000;
        let maxEnd = 1;
        while (!it.EndReached && guard-- > 0) {
          const tick = Math.round(it.currentTimeStamp.RealValue * 4 * PPQ);
          steps.push(tick);
          for (const entry of it.CurrentVoiceEntries ?? []) {
            if (entry.IsGrace) continue;
            for (const n of entry.Notes ?? []) {
              if (n.isRest()) continue;
              if (n.NoteTie && n.NoteTie.StartNote !== n) continue;
              const durTicks = Math.max(1, Math.round(n.Length.RealValue * 4 * PPQ));
              maxEnd = Math.max(maxEnd, tick + durTicks);
              const ev =
                events.get(tick) ??
                events.set(tick, { tick, durTicks, pitches: [], velocity: 0.8 }).get(tick)!;
              ev.pitches.push(n.halfTone + 12);
              ev.durTicks = Math.max(ev.durTicks, durTicks);
            }
          }
          it.moveToNext();
        }
        osmd.cursor.reset();

        if (events.size === 0) throw new Error("empty score");
        eventsRef.current = [...events.values()].sort((a, b) => a.tick - b.tick);
        stepsRef.current = steps;
        durationTicksRef.current = maxEnd;
        osmdRef.current = osmd;
        stepIndexRef.current = 0;
        setStatus("ready");
        syncTimeUi();
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
      try {
        osmd?.clear();
      } catch {
        /* jsdom-less teardown must never throw */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXmlUrl]);

  /* ---------- resize: re-render and restore cursor state ---------- */
  useEffect(() => {
    if (status !== "ready") return;
    const box = scrollRef.current;
    if (!box) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastW = box.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = box.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const osmd = osmdRef.current;
        if (!osmd) return;
        try {
          clearHighlights();
          osmd.render();
          osmd.cursor.show();
          osmd.cursor.reset();
          let guard = stepsRef.current.length + 1;
          for (let i = 0; i < stepIndexRef.current && guard-- > 0; i++) osmd.cursor.next();
          styleCursor(osmd);
          highlightUnderCursor();
        } catch {
          /* a failed re-render keeps the previous layout — acceptable */
        }
      }, 250);
    });
    ro.observe(box);
    return () => {
      ro.disconnect();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* ---------- cursor + time UI loop ---------- */
  useEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    const tick = () => {
      const eng = engineRef.current;
      const osmd = osmdRef.current;
      if (playingRef.current && eng && osmd) {
        posRef.current = Math.min(eng.transport.ticks, durationTicksRef.current);
        advanceCursorTo(posRef.current);
        syncTimeUi();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const styleCursor = (osmd: OSMD) => {
    const el = osmd.cursor?.cursorElement as HTMLElement | undefined;
    if (!el) return;
    el.style.zIndex = "5";
    el.style.pointerEvents = "none";
  };

  const clearHighlights = () => {
    for (const { el } of litRef.current) {
      el.style.fill = "";
      el.style.stroke = "";
      el.style.filter = "";
    }
    litRef.current = [];
  };

  /* Paint the noteheads under the cursor amber — live SVG styling, no
     re-render. Any OSMD internals access is best-effort. */
  const highlightUnderCursor = () => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    clearHighlights();
    try {
      for (const gNote of osmd.cursor.GNotesUnderCursor() ?? []) {
        const g = (
          gNote as unknown as { getSVGGElement?: () => SVGElement | undefined }
        ).getSVGGElement?.();
        if (!g) continue;
        g.style.fill = "#f59e0b";
        g.style.stroke = "#f59e0b";
        litRef.current.push({ el: g });
      }
    } catch {
      /* highlighting is decoration — never let it break playback */
    }
  };

  const advanceCursorTo = (tick: number) => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    const steps = stepsRef.current;
    let i = stepIndexRef.current;
    let moved = false;
    let guard = steps.length + 1;
    while (i + 1 < steps.length && steps[i + 1] <= tick && guard-- > 0) {
      osmd.cursor.next();
      i++;
      moved = true;
    }
    if (moved) {
      stepIndexRef.current = i;
      highlightUnderCursor();
      followCursor();
    }
  };

  const followCursor = () => {
    const el = osmdRef.current?.cursor?.cursorElement;
    const box = scrollRef.current;
    if (!el || !box) return;
    const top = el.offsetTop;
    if (top < box.scrollTop + 20 || top > box.scrollTop + box.clientHeight - 90) {
      box.scrollTo({ top: Math.max(0, top - box.clientHeight * 0.3), behavior: "smooth" });
    }
  };

  const resetCursor = () => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    osmd.cursor.reset();
    stepIndexRef.current = 0;
    clearHighlights();
  };

  const syncTimeUi = () => {
    const bpm = baseBpmRef.current * (tempoRef.current / 100);
    const toSec = (ticks: number) => (ticks / PPQ) * (60 / bpm);
    if (timeRef.current) {
      timeRef.current.textContent = `${fmtTime(toSec(posRef.current))} / ${fmtTime(
        toSec(durationTicksRef.current)
      )}`;
    }
    if (seekRef.current && !seekingRef.current) {
      seekRef.current.value = String(
        Math.round((posRef.current / durationTicksRef.current) * 1000)
      );
    }
  };

  /* ---------- audio engine ---------- */
  const ensureEngine = async (): Promise<Engine> => {
    if (engineRef.current) return engineRef.current;
    const Tone = await import("tone");
    await Tone.start();

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.PPQ = PPQ;
    transport.bpm.value = baseBpmRef.current * (tempoRef.current / 100);
    transport.loop = loopRef.current;
    transport.loopStart = 0;
    transport.loopEnd = `${durationTicksRef.current}i`;

    const limiter = new Tone.Limiter(-1).toDestination();
    const master = new Tone.Volume(-7).connect(limiter);
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.18, sustain: 0.45, release: 0.3 },
    });
    synth.maxPolyphony = 48;
    synth.connect(master);

    const part = new Tone.Part(
      (time, ev: ScoreEvent) => {
        const bpmNow = transport.bpm.value;
        const durSec = Math.max(MIN_NOTE_SEC, (ev.durTicks / PPQ) * (60 / bpmNow) * 0.92);
        for (const p of ev.pitches) {
          synth.triggerAttackRelease(
            Tone.Frequency(p, "midi").toFrequency(),
            durSec,
            time,
            ev.velocity
          );
        }
      },
      eventsRef.current.map((ev) => [`${ev.tick}i`, ev] as [string, ScoreEvent])
    ).start(0);

    transport.scheduleRepeat(
      () => {
        if (transport.ticks >= durationTicksRef.current - 1) {
          if (loopRef.current) {
            resetCursor();
            return;
          }
          transport.pause();
          synth.releaseAll();
          playingRef.current = false;
          setIsPlaying(false);
          posRef.current = 0;
          transport.ticks = 0;
          resetCursor();
          syncTimeUi();
        }
      },
      0.05,
      0
    );

    const eng: Engine = { Tone, transport, synth, part, nodes: [limiter, master] };
    engineRef.current = eng;
    return eng;
  };

  useEffect(() => {
    return () => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.transport.stop();
      eng.transport.cancel();
      eng.transport.loop = false;
      eng.part.dispose();
      eng.synth.dispose();
      eng.nodes.forEach((n) => n.dispose());
      engineRef.current = null;
    };
  }, []);

  /* ---------- transport actions ---------- */
  const togglePlay = async () => {
    const eng = await ensureEngine();
    if (playingRef.current) {
      eng.transport.pause();
      eng.synth.releaseAll();
      playingRef.current = false;
      setIsPlaying(false);
    } else {
      eng.transport.ticks = posRef.current;
      eng.transport.start();
      playingRef.current = true;
      setIsPlaying(true);
    }
  };

  const stop = () => {
    const eng = engineRef.current;
    if (eng) {
      eng.transport.pause();
      eng.transport.ticks = 0;
      eng.synth.releaseAll();
    }
    playingRef.current = false;
    setIsPlaying(false);
    posRef.current = 0;
    resetCursor();
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    syncTimeUi();
  };

  const seekTo = (tick: number) => {
    const t = Math.max(0, Math.min(durationTicksRef.current, tick));
    posRef.current = t;
    const eng = engineRef.current;
    if (eng) {
      eng.synth.releaseAll();
      eng.transport.ticks = t;
    }
    /* Cursor can only walk forward — rewind means reset then fast-forward. */
    if (t < (stepsRef.current[stepIndexRef.current] ?? 0)) resetCursor();
    advanceCursorTo(t);
    followCursor();
    syncTimeUi();
  };

  const setTempo = (pct: number) => {
    tempoRef.current = pct;
    setTempoPct(pct);
    const eng = engineRef.current;
    if (eng) eng.transport.bpm.value = baseBpmRef.current * (pct / 100);
    syncTimeUi();
  };

  const toggleLoop = () => {
    const next = !loopRef.current;
    loopRef.current = next;
    setLoop(next);
    const eng = engineRef.current;
    if (eng) eng.transport.loop = next;
  };

  /* ---------- render ---------- */
  if (status === "error") return <>{fallback}</>;

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className={cn(
          "relative max-h-[70vh] overflow-y-auto overscroll-contain rounded-xl border border-amber-500/30 bg-white shadow-[0_8px_40px_-12px_rgba(232,162,61,0.35)]",
          status === "loading" && "min-h-[220px]"
        )}
      >
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            Engraving your score…
          </div>
        )}
        <div ref={hostRef} className="px-3 py-2" />
      </div>

      {status === "ready" && (
        <>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-black transition hover:bg-amber-400 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="h-4.5 w-4.5" />
              ) : (
                <Play className="ml-0.5 h-4.5 w-4.5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Stop"
              onClick={stop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 active:scale-95"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Loop"
              aria-pressed={loop}
              onClick={toggleLoop}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 transition hover:bg-white/10 active:scale-95",
                loop ? "bg-amber-500/20 text-amber-400" : "text-white/60"
              )}
            >
              <Repeat className="h-3.5 w-3.5" />
            </button>

            <input
              ref={seekRef}
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              aria-label="Seek"
              className="af-sheet-range min-w-0 flex-1"
              onPointerDown={() => (seekingRef.current = true)}
              onPointerUp={() => (seekingRef.current = false)}
              onChange={(e) =>
                seekTo((Number(e.target.value) / 1000) * durationTicksRef.current)
              }
            />

            <span
              ref={timeRef}
              className="shrink-0 font-mono text-[11px] tabular-nums text-white/60"
            >
              0:00 / 0:00
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTempo(100)}
              title="Reset tempo to 100%"
              aria-label="Reset tempo to 100%"
              className={cn(
                "w-12 shrink-0 rounded px-1 py-0.5 text-left text-[11px] transition hover:bg-white/10",
                tempoPct === 100 ? "text-white/50" : "text-amber-400"
              )}
            >
              {tempoPct}%
            </button>
            <input
              type="range"
              min={50}
              max={150}
              step={1}
              value={tempoPct}
              aria-label="Playback speed"
              className="af-sheet-range flex-1"
              onChange={(e) => setTempo(Number(e.target.value))}
            />
            <span className="shrink-0 text-[11px] text-white/40">
              {Math.round(baseBpm * (tempoPct / 100))} BPM
            </span>
          </div>
        </>
      )}

      <style>{`
        .af-sheet-range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.12);
          outline: none;
        }
        .af-sheet-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 13px;
          width: 13px;
          border-radius: 9999px;
          background: #f59e0b;
          border: none;
          cursor: pointer;
          transition: transform 120ms ease;
        }
        .af-sheet-range::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .af-sheet-range::-moz-range-thumb {
          height: 13px;
          width: 13px;
          border-radius: 9999px;
          background: #f59e0b;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}