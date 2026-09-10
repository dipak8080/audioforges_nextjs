"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Download,
  Headphones,
  Loader2,
  Pause,
  Play,
  Printer,
  Repeat,
  Sparkles,
  Square,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  INSTRUMENTS,
  makeInstrument,
  mixGains,
  type Instrument,
  type InstrumentKind,
} from "@/lib/audio/instruments";

type ToneModule = typeof import("tone");
type OSMD = import("opensheetmusicdisplay").OpenSheetMusicDisplay;

type ScoreEvent = { tick: number; durTicks: number; pitches: number[]; velocity: number };

type Engine = {
  Tone: ToneModule;
  transport: ReturnType<ToneModule["getTransport"]>;
  synth: Instrument;
  channel: InstanceType<ToneModule["Channel"]>;
  part: { dispose: () => void };
  nodes: { dispose: () => void }[];
  midiGain: InstanceType<ToneModule["Gain"]>;
  origGain: InstanceType<ToneModule["Gain"]>;
  original: InstanceType<ToneModule["Player"]> | null;
};

const ZOOMS = [0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5];

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
  sourceFile,
  title,
}: {
  musicXmlUrl: string;
  tempoBpm: number;
  fallback: React.ReactNode;
  /** The audio the score was transcribed from — enables the original A/B. */
  sourceFile?: File | null;
  title?: string | null;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempoPct, setTempoPct] = useState(100);
  const [loop, setLoop] = useState(false);
  const [instrument, setInstrument] = useState<InstrumentKind>("piano");
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const [compare, setCompare] = useState(false);
  const [mix, setMix] = useState(1);
  const [originalReady, setOriginalReady] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(4);
  const [transpose, setTranspose] = useState(0);
  const [busy, setBusy] = useState(false);

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
  const instrumentRef = useRef<InstrumentKind>("piano");
  const mixRef = useRef(1);
  const compareRef = useRef(false);
  const metroRef = useRef(false);
  const transposeRef = useRef(0);
  const zoomIdxRef = useRef(4);
  const sourceUrlRef = useRef<string | null>(null);
  const litRef = useRef<{ el: SVGElement | HTMLElement; fill: string; stroke: string }[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);
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

  /* OSMD's own cursor img is created with z-index -2 — behind the white sheet.
     We hide it and drive our own overlay div from the coordinates OSMD keeps
     computing on it. The overlay is plain DOM we fully control. */
  const styleCursor = (osmd: OSMD) => {
    const el = osmd.cursor?.cursorElement as HTMLImageElement | undefined;
    if (!el || !el.parentElement) return;
    el.style.display = "none";
    let overlay = overlayRef.current;
    if (!overlay || overlay.parentElement !== el.parentElement) {
      overlay?.remove();
      overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.zIndex = "10";
      overlay.style.pointerEvents = "none";
      overlay.style.background = "rgba(245, 158, 11, 0.28)";
      overlay.style.borderLeft = "2px solid rgba(245, 158, 11, 0.95)";
      overlay.style.borderRadius = "2px";
      overlay.style.boxShadow = "0 0 10px rgba(245, 158, 11, 0.35)";
      overlay.style.transition = "top 60ms linear, left 60ms linear";
      el.parentElement.appendChild(overlay);
      overlayRef.current = overlay;
    }
    positionOverlay(osmd);
  };

  const positionOverlay = (osmd: OSMD) => {
    const el = osmd.cursor?.cursorElement as HTMLImageElement | undefined;
    const overlay = overlayRef.current;
    if (!el || !overlay) return;
    overlay.style.top = el.style.top;
    overlay.style.left = el.style.left;
    overlay.style.width = `${el.width || 12}px`;
    overlay.style.height = `${el.height || 60}px`;
  };

  const clearHighlights = () => {
    for (const { el, fill, stroke } of litRef.current) {
      el.style.fill = fill;
      el.style.stroke = stroke;
    }
    litRef.current = [];
  };

  /* VexFlow sets fill/stroke ATTRIBUTES on note paths; inherited style on the
     group loses to those. Inline style per element wins — so paint each one. */
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
        const nodes: (SVGElement | HTMLElement)[] = [
          g,
          ...(Array.from(g.querySelectorAll("path, rect, ellipse, text")) as SVGElement[]),
        ];
        for (const node of nodes) {
          litRef.current.push({ el: node, fill: node.style.fill, stroke: node.style.stroke });
          if (node.getAttribute("fill") !== "none") node.style.fill = "#f59e0b";
          if (node.getAttribute("stroke") && node.getAttribute("stroke") !== "none") {
            node.style.stroke = "#f59e0b";
          }
        }
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
      positionOverlay(osmd);
      highlightUnderCursor();
      followCursor();
    }
  };

  const followCursor = () => {
    const el = overlayRef.current;
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
    positionOverlay(osmd);
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
    const g0 = mixGains(mixRef.current, compareRef.current);
    const midiGain = new Tone.Gain(g0.midi).connect(limiter);
    const origGain = new Tone.Gain(g0.orig).connect(limiter);
    const master = new Tone.Volume(-7).connect(midiGain);
    const channel = new Tone.Channel().connect(master);

    const eng: Engine = {
      Tone,
      transport,
      synth: makeInstrument(Tone, instrumentRef.current, false, () => setInstrumentLoading(false)),
      channel,
      part: { dispose: () => {} },
      nodes: [limiter, master, midiGain, origGain, channel],
      midiGain,
      origGain,
      original: null,
    };
    setInstrumentLoading(true);
    eng.synth.connect(channel);

    eng.part = new Tone.Part(
      (time, ev: ScoreEvent) => {
        const bpmNow = transport.bpm.value;
        const durSec = Math.max(MIN_NOTE_SEC, (ev.durTicks / PPQ) * (60 / bpmNow) * 0.92);
        for (const p of ev.pitches) {
          eng.synth.triggerAttackRelease(
            Tone.Frequency(p + transposeRef.current, "midi").toFrequency(),
            durSec,
            time,
            ev.velocity
          );
        }
      },
      eventsRef.current.map((ev) => [`${ev.tick}i`, ev] as [string, ScoreEvent])
    ).start(0);

    const click = new Tone.MembraneSynth({
      pitchDecay: 0.005,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).connect(midiGain);
    click.volume.value = -8;
    eng.nodes.push(click);
    transport.scheduleRepeat((time) => {
      if (!metroRef.current) return;
      const ticks = transport.getTicksAtTime(time);
      const accent = Math.abs(ticks % (PPQ * 4)) < PPQ / 2;
      click.triggerAttackRelease(accent ? "C6" : "G5", 0.03, time, accent ? 0.9 : 0.55);
    }, "4n", 0);

    if (sourceUrlRef.current) {
      const player = new Tone.Player({
        url: sourceUrlRef.current,
        onload: () => setOriginalReady(true),
      }).connect(origGain);
      player.playbackRate = tempoRef.current / 100;
      eng.original = player;
    }

    transport.scheduleRepeat(
      () => {
        if (transport.ticks >= durationTicksRef.current - 1) {
          if (loopRef.current) {
            resetCursor();
            posRef.current = 0;
            startOriginal(eng);
            return;
          }
          transport.pause();
          eng.synth.releaseAll();
          stopOriginal(eng);
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

    engineRef.current = eng;
    return eng;
  };

  const originalOffsetSec = () => (posRef.current / PPQ) * (60 / baseBpmRef.current);

  const startOriginal = (eng: Engine) => {
    const p = eng.original;
    if (!p || !p.loaded) return;
    try {
      p.stop();
    } catch {}
    const off = originalOffsetSec();
    if (off < p.buffer.duration) p.start(undefined, off);
  };

  const stopOriginal = (eng: Engine | null) => {
    const p = eng?.original;
    if (!p) return;
    try {
      p.stop();
    } catch {}
  };

  const changeInstrument = (kind: InstrumentKind) => {
    instrumentRef.current = kind;
    setInstrument(kind);
    const eng = engineRef.current;
    if (!eng) return;
    eng.synth.releaseAll();
    eng.synth.dispose();
    setInstrumentLoading(true);
    eng.synth = makeInstrument(eng.Tone, kind, false, () => setInstrumentLoading(false));
    eng.synth.connect(eng.channel);
  };

  const applyMix = (nextMix: number, nextCompare: boolean) => {
    mixRef.current = nextMix;
    compareRef.current = nextCompare;
    setMix(nextMix);
    setCompare(nextCompare);
    const eng = engineRef.current;
    if (eng) {
      const g = mixGains(nextMix, nextCompare);
      eng.midiGain.gain.rampTo(g.midi, 0.05);
      eng.origGain.gain.rampTo(g.orig, 0.05);
    }
  };

  const toggleCompare = async () => {
    const next = !compareRef.current;
    if (next && !engineRef.current) await ensureEngine();
    applyMix(next ? 0.5 : 1, next);
  };

  const toggleMetronome = async () => {
    const next = !metroRef.current;
    metroRef.current = next;
    setMetronome(next);
    if (next && !engineRef.current) await ensureEngine();
  };

  /* Re-engrave (zoom / transpose) and put the cursor back where it was. */
  const rerender = () => {
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
      positionOverlay(osmd);
    } catch {}
  };

  const setZoom = (idx: number) => {
    const osmd = osmdRef.current;
    const i = Math.max(0, Math.min(ZOOMS.length - 1, idx));
    zoomIdxRef.current = i;
    setZoomIdx(i);
    if (!osmd) return;
    osmd.Zoom = ZOOMS[i];
    rerender();
  };

  const setTransposeSemis = async (semis: number) => {
    const osmd = osmdRef.current;
    if (!osmd || busy) return;
    const n = Math.max(-12, Math.min(12, semis));
    setBusy(true);
    try {
      const { TransposeCalculator } = await import("opensheetmusicdisplay");
      if (!osmd.TransposeCalculator) osmd.TransposeCalculator = new TransposeCalculator();
      osmd.Sheet.Transpose = n;
      osmd.updateGraphic();
      transposeRef.current = n;
      setTranspose(n);
      rerender();
    } catch {
      /* transposition is optional — leave the score as-is */
    } finally {
      setBusy(false);
    }
  };

  const scoreSvgs = () => Array.from(hostRef.current?.querySelectorAll("svg") ?? []);

  const printScore = () => {
    const svgs = scoreSvgs();
    if (svgs.length === 0) return;
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    const markup = svgs.map((el) => el.outerHTML).join("\n");
    const name = (title || "score").replace(/</g, "");
    win.document.write(
      `<!doctype html><html><head><title>${name} — AudioForges</title><style>@page{margin:14mm}body{margin:0;background:#fff}svg{display:block;width:100%;height:auto;page-break-after:always}</style></head><body>${markup}</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const downloadPng = async () => {
    const svgs = scoreSvgs();
    if (svgs.length === 0) return;
    const svg = svgs[0];
    const bbox = svg.getBoundingClientRect();
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bbox.width * scale);
    canvas.height = Math.round(bbox.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(bbox.width));
    clone.setAttribute("height", String(bbox.height));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg"));
      img.src = url;
    });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = `${(title || "score").replace(/\.[^.]+$/, "")} (AudioForges).png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
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
      eng.original?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sourceFile) {
      sourceUrlRef.current = null;
      return;
    }
    const url = URL.createObjectURL(sourceFile);
    sourceUrlRef.current = url;
    return () => {
      URL.revokeObjectURL(url);
      sourceUrlRef.current = null;
    };
  }, [sourceFile]);

  /* ---------- transport actions ---------- */
  const togglePlay = async () => {
    const eng = await ensureEngine();
    if (playingRef.current) {
      eng.transport.pause();
      eng.synth.releaseAll();
      stopOriginal(eng);
      playingRef.current = false;
      setIsPlaying(false);
    } else {
      eng.transport.ticks = posRef.current;
      eng.transport.start();
      startOriginal(eng);
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
      stopOriginal(eng);
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
      if (playingRef.current) startOriginal(eng);
    }
    /* Cursor can only walk forward — rewind means reset then fast-forward. */
    if (t < (stepsRef.current[stepIndexRef.current] ?? 0)) resetCursor();
    advanceCursorTo(t);
    const osmd = osmdRef.current;
    if (osmd) positionOverlay(osmd);
    followCursor();
    syncTimeUi();
  };

  const setTempo = (pct: number) => {
    tempoRef.current = pct;
    setTempoPct(pct);
    const eng = engineRef.current;
    if (eng) {
      eng.transport.bpm.value = baseBpmRef.current * (pct / 100);
      if (eng.original) {
        eng.original.playbackRate = pct / 100;
        if (playingRef.current) {
          posRef.current = eng.transport.ticks;
          startOriginal(eng);
        }
      }
    }
    syncTimeUi();
  };

  const toggleLoop = () => {
    const next = !loopRef.current;
    loopRef.current = next;
    setLoop(next);
    const eng = engineRef.current;
    if (eng) eng.transport.loop = next;
  };

  /* ---------- keyboard + Ctrl+wheel zoom ---------- */
  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || el?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
      } else if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(zoomIdxRef.current + 1);
      } else if (mod && e.key === "-") {
        e.preventDefault();
        setZoom(zoomIdxRef.current - 1);
      }
    };
    const box = scrollRef.current;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(zoomIdxRef.current + (e.deltaY < 0 ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    box?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      box?.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* ---------- render ---------- */
  if (status === "error") return <>{fallback}</>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Forge Score
        </span>
        {status === "ready" && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div className="flex items-center overflow-hidden rounded-md border border-white/10 bg-black/20">
              <button
                type="button"
                onClick={() => void setTransposeSemis(transpose - 1)}
                disabled={busy || transpose <= -12}
                title="Transpose down a semitone"
                className="h-8 px-2 text-[11px] text-white/65 transition hover:bg-white/10 disabled:opacity-40"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => void setTransposeSemis(0)}
                title="Transpose — click to reset"
                className={cn(
                  "h-8 min-w-[64px] px-2 font-mono text-[11px] transition hover:bg-white/10",
                  transpose === 0 ? "text-white/55" : "text-amber-400"
                )}
              >
                {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : `${transpose > 0 ? "+" : ""}${transpose} st`}
              </button>
              <button
                type="button"
                onClick={() => void setTransposeSemis(transpose + 1)}
                disabled={busy || transpose >= 12}
                title="Transpose up a semitone"
                className="h-8 px-2 text-[11px] text-white/65 transition hover:bg-white/10 disabled:opacity-40"
              >
                +
              </button>
            </div>
            <IconBtn label="Zoom out (Ctrl −)" onClick={() => setZoom(zoomIdx - 1)} disabled={zoomIdx === 0}>
              <ZoomOut className="h-3.5 w-3.5" />
            </IconBtn>
            <span className="w-9 text-center font-mono text-[10px] text-white/45">{Math.round(ZOOMS[zoomIdx] * 100)}%</span>
            <IconBtn label="Zoom in (Ctrl +)" onClick={() => setZoom(zoomIdx + 1)} disabled={zoomIdx === ZOOMS.length - 1}>
              <ZoomIn className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Print or save as PDF" onClick={printScore}>
              <Printer className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Download score as PNG" onClick={() => void downloadPng()}>
              <Download className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        )}
      </div>
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="h-4.5 w-4.5" />
              ) : (
                <Play className="ml-0.5 h-4.5 w-4.5" />
              )}
            </button>
            <IconBtn label="Stop" onClick={stop}>
              <Square className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Loop" onClick={toggleLoop} active={loop}>
              <Repeat className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Metronome click" onClick={() => void toggleMetronome()} active={metronome}>
              <Headphones className="h-3.5 w-3.5" />
            </IconBtn>

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

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">Sound</span>
            {INSTRUMENTS.map((inst) => (
              <button
                key={inst.key}
                type="button"
                onClick={() => changeInstrument(inst.key)}
                aria-pressed={instrument === inst.key}
                title={inst.key === "piano" ? "Sampled grand piano (loads on first play)" : `Play back with a ${inst.label.toLowerCase()} sound`}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  instrument === inst.key
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-white/10 text-white/55 hover:border-white/20 hover:text-white/80"
                )}
              >
                {inst.label}
              </button>
            ))}
            {instrumentLoading && (
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                loading
              </span>
            )}
            {sourceFile && (
              <button
                type="button"
                onClick={() => void toggleCompare()}
                aria-pressed={compare}
                title="Play your original audio alongside the score to check accuracy"
                className={cn(
                  "ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  compare
                    ? "border-teal-400/60 bg-teal-400/10 text-teal-300"
                    : "border-white/10 text-white/55 hover:border-white/20 hover:text-white/80"
                )}
              >
                <AudioLines className="h-3 w-3" aria-hidden />
                Compare original
              </button>
            )}
          </div>

          {compare && (
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-full border border-white/10">
                {[
                  { v: 0, l: "Original" },
                  { v: 0.5, l: "Both" },
                  { v: 1, l: "Score" },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    onClick={() => applyMix(o.v, true)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] transition-colors",
                      Math.abs(mix - o.v) < 0.02 ? "bg-teal-400/15 text-teal-300" : "text-white/55 hover:bg-white/5"
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <span className="w-14 shrink-0 text-right text-[11px] text-white/50">Original</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(mix * 100)}
                aria-label="Crossfade between original audio and score playback"
                className="af-sheet-range flex-1"
                onChange={(e) => applyMix(Number(e.target.value) / 100, true)}
              />
              <span className="w-12 shrink-0 text-[11px] text-white/50">Score</span>
              {!originalReady && <Loader2 className="h-3 w-3 animate-spin text-white/40" aria-hidden />}
            </div>
          )}

          <p className="text-[10.5px] text-white/35">
            Space play · Ctrl+scroll zoom · cursor follows the music
          </p>
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

function IconBtn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 transition hover:bg-white/10 active:scale-95 disabled:pointer-events-none disabled:opacity-35",
        active ? "bg-amber-500/20 text-amber-400" : "text-white/60"
      )}
    >
      {children}
    </button>
  );
}