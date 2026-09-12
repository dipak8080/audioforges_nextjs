"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import {
  AudioLines,
  Check,
  ChevronDown,
  Download,
  Headphones,
  HelpCircle,
  Loader2,
  Magnet,
  Maximize2,
  Minus,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  Repeat,
  Sparkles,
  Square,
  Undo2,
  VolumeX,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  INSTRUMENTS,
  makeInstrument,
  mixGains,
  prefetchPiano,
  type Instrument,
  type InstrumentKind,
} from "@/lib/audio/instruments";

type ToneModule = typeof import("tone");

type PlayerNote = { t: number; d: number; p: number; v: number };

type PlayerTrack = {
  name: string;
  color: string;
  bright: string;
  notes: PlayerNote[];
  maxDur: number;
  percussion: boolean;
};

type ParsedMidi = {
  tracks: PlayerTrack[];
  ppq: number;
  baseBpm: number;
  beatsPerBar: number;
  durationTicks: number;
  loPitch: number;
  hiPitch: number;
};



type Engine = {
  Tone: ToneModule;
  transport: ReturnType<ToneModule["getTransport"]>;
  synths: Instrument[];
  channels: InstanceType<ToneModule["Channel"]>[];
  parts: { dispose: () => void }[];
  nodes: { dispose: () => void }[];
  midiGain: InstanceType<ToneModule["Gain"]>;
  origGain: InstanceType<ToneModule["Gain"]>;
  original: InstanceType<ToneModule["Player"]> | null;
};

const PALETTE: [string, string][] = [
  ["#f59e0b", "#fcd34d"],
  ["#38bdf8", "#7dd3fc"],
  ["#a78bfa", "#c4b5fd"],
  ["#34d399", "#6ee7b7"],
  ["#fb7185", "#fda4af"],
  ["#22d3ee", "#67e8f9"],
  ["#a3e635", "#bef264"],
  ["#fb923c", "#fdba74"],
];

const MIN_NOTE_SEC = 0.03;
const FOLLOW_AT = 0.72;
const KEYS_W = 62;
const RULER_H = 26;
const VEL_H = 54;
const ROW_MIN = 17;
const ROW_MAX = 24;
const CANVAS_MAX_H = 540;
const SCROLL_W = 9;
const SCROLL_H = 9;
const BLACK_PC = new Set([1, 3, 6, 8, 10]);
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FOLLOW_TO = 0.28;

/* Temperley (2001) key profiles — more robust on sparse, transcribed
 * material than Krumhansl. Weighted by duration × velocity, with extra weight
 * on the lowest voice, since bass notes carry the tonal centre. */
const MAJOR_PROFILE = [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0];
const MINOR_PROFILE = [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

type DetectedKey = { tonic: number; mode: "major" | "minor"; label: string; pcs: Set<number> };

function keyFor(tonic: number, mode: "major" | "minor"): DetectedKey {
  const scale = mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
  return {
    tonic,
    mode,
    label: `${NAMES[tonic]} ${mode}`,
    pcs: new Set(scale.map((i) => (i + tonic) % 12)),
  };
}

const ALL_KEYS: DetectedKey[] = [
  ...Array.from({ length: 12 }, (_, t) => keyFor(t, "major")),
  ...Array.from({ length: 12 }, (_, t) => keyFor(t, "minor")),
];

function detectKey(d: ParsedMidi): DetectedKey | null {
  const hist = new Array<number>(12).fill(0);
  let total = 0;
  let lowest = 127;
  for (const t of d.tracks) {
    if (t.percussion) continue;
    for (const n of t.notes) lowest = Math.min(lowest, n.p);
  }
  for (const t of d.tracks) {
    if (t.percussion) continue;
    for (const n of t.notes) {
      const bassBoost = n.p <= lowest + 7 ? 1.6 : 1;
      const w = n.d * (0.4 + n.v * 0.6) * bassBoost;
      hist[n.p % 12] += w;
      total += w;
    }
  }
  if (total === 0) return null;
  const corr = (profile: number[], shift: number) => {
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < 12; i++) {
      const x = hist[(i + shift) % 12];
      const y = profile[i];
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
    const den = Math.sqrt((12 * sxx - sx * sx) * (12 * syy - sy * sy));
    return den === 0 ? 0 : (12 * sxy - sx * sy) / den;
  };
  let best: DetectedKey | null = null;
  let bestScore = -Infinity;
  for (let tonic = 0; tonic < 12; tonic++) {
    const maj = corr(MAJOR_PROFILE, tonic);
    const min = corr(MINOR_PROFILE, tonic);
    if (maj > bestScore) { bestScore = maj; best = keyFor(tonic, "major"); }
    if (min > bestScore) { bestScore = min; best = keyFor(tonic, "minor"); }
  }
  return best;
}

type Snapshot = PlayerNote[][];

const snapshotOf = (d: ParsedMidi): Snapshot => d.tracks.map((t) => t.notes.map((n) => ({ ...n })));

function restoreSnapshot(d: ParsedMidi, snap: Snapshot) {
  d.tracks.forEach((t, i) => {
    t.notes = snap[i].map((n) => ({ ...n }));
    t.maxDur = t.notes.reduce((m, n) => Math.max(m, n.d), 1);
  });
  recomputeExtent(d);
}

function recomputeExtent(d: ParsedMidi) {
  let end = 0;
  for (const t of d.tracks) for (const n of t.notes) end = Math.max(end, n.t + n.d);
  d.durationTicks = Math.max(end, d.ppq);
}

function buildMidiFile(d: ParsedMidi): Uint8Array {
  const midi = new Midi();
  const k = midi.header.ppq / d.ppq;
  midi.header.setTempo(d.baseBpm);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [d.beatsPerBar, 4] }];
  d.tracks.forEach((t) => {
    const track = midi.addTrack();
    track.name = t.name;
    if (t.percussion) track.channel = 9;
    for (const n of t.notes) {
      track.addNote({
        midi: n.p,
        ticks: Math.round(n.t * k),
        durationTicks: Math.max(1, Math.round(n.d * k)),
        velocity: n.v,
      });
    }
  });
  return midi.toArray();
}

const fmtTime = (s: number) => {
  const x = Math.max(0, Math.floor(s));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
};

function parseMidi(buf: ArrayBuffer): ParsedMidi | null {
  const midi = new Midi(buf);
  const raw = midi.tracks.filter((t) => t.notes.length > 0);
  if (raw.length === 0) return null;

  let lo = 127;
  let hi = 0;
  let end = 0;

  const tracks: PlayerTrack[] = raw.map((t, i) => {
    const notes: PlayerNote[] = t.notes.map((n) => {
      lo = Math.min(lo, n.midi);
      hi = Math.max(hi, n.midi);
      end = Math.max(end, n.ticks + n.durationTicks);
      return { t: n.ticks, d: Math.max(1, n.durationTicks), p: n.midi, v: n.velocity };
    });
    notes.sort((a, b) => a.t - b.t);
    const [color, bright] = PALETTE[i % PALETTE.length];
    return {
      name: t.name?.trim() || t.instrument?.name || `Track ${i + 1}`,
      color,
      bright,
      notes,
      maxDur: notes.reduce((m, n) => Math.max(m, n.d), 1),
      percussion: !!t.instrument?.percussion,
    };
  });

  return {
    tracks,
    ppq: midi.header.ppq || 480,
    baseBpm: midi.header.tempos[0]?.bpm || 120,
    beatsPerBar: midi.header.timeSignatures[0]?.timeSignature?.[0] || 4,
    durationTicks: Math.max(end, midi.durationTicks, 1),
    loPitch: Math.max(0, lo - 2),
    hiPitch: Math.min(127, hi + 3),
  };
}

export function MidiResultPlayer({
  src,
  sourceFile,
}: {
  src: string;
  /** The audio the MIDI was transcribed from — enables the original A/B. */
  sourceFile?: File | null;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<ParsedMidi | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempoPct, setTempoPct] = useState(100);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState<Set<number>>(new Set());
  const [soloed, setSoloed] = useState<Set<number>>(new Set());
  const [instrument, setInstrument] = useState<InstrumentKind>("piano");
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const instrReadyRef = useRef<Promise<void> | null>(null);
  const [compare, setCompare] = useState(false);
  const [mix, setMix] = useState(1);
  const [originalReady, setOriginalReady] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [snapDiv, setSnapDiv] = useState<0 | 4 | 8 | 16 | 32>(16);
  const [keyOverride, setKeyOverride] = useState<string>("auto");
  const [historyLen, setHistoryLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);
  const [detectedKey, setDetectedKey] = useState<DetectedKey | null>(null);
  const [scaleHighlight, setScaleHighlight] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [loopRegion, setLoopRegion] = useState<{ a: number; b: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const [panel, setPanel] = useState<null | "notes" | "help" | "compare">(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  const engineRef = useRef<Engine | null>(null);
  const dataRef = useRef<ParsedMidi | null>(null);
  const posRef = useRef(0);
  const scrollRef = useRef(0);
  const pxPerTickRef = useRef(0);
  const minZoomRef = useRef(0);
  const rowHRef = useRef(ROW_MIN);
  const vScrollRef = useRef(0);
  const vInitRef = useRef(false);
  const dirtyRef = useRef(true);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const tempoRef = useRef(100);
  const seekingRef = useRef(false);
  const mutedRef = useRef(muted);
  const soloedRef = useRef(soloed);
  const instrumentRef = useRef<InstrumentKind>("piano");
  const mixRef = useRef(1);
  const compareRef = useRef(false);
  const sourceUrlRef = useRef<string | null>(null);
  const editRef = useRef(false);
  const followRef = useRef(true);
  const clickRef = useRef({ t: 0, x: 0, y: 0 });
  const scrollDragRef = useRef<null | { axis: "v" | "h"; from: number; base: number }>(null);
  const eraseRef = useRef(false);
  const suppressMenuRef = useRef(false);
  const snapDivRef = useRef<0 | 4 | 8 | 16 | 32>(16);
  const autoKeyRef = useRef<DetectedKey | null>(null);
  const selectedRef = useRef<PlayerNote | null>(null);
  const historyRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const dragRef = useRef<null | {
    kind: "move" | "resize";
    note: PlayerNote;
    ti: number;
    startX: number;
    startY: number;
    orig: PlayerNote;
    changed: boolean;
    lastPitch: number;
  }>(null);
  const lastLenRef = useRef(0);
  const keyRef = useRef<DetectedKey | null>(null);
  const scaleRef = useRef(false);
  const metroRef = useRef(false);
  const loopRegionRef = useRef<{ a: number; b: number } | null>(null);
  const rulerDragRef = useRef<null | { kind: "scrub" | "region"; anchor: number; moved: boolean }>(null);
  const hoverNoteRef = useRef<PlayerNote | null>(null);
  const hoverTsRef = useRef(0);
  const pinchRef = useRef<Map<number, number>>(new Map());
  const pinchDistRef = useRef(0);

  editRef.current = editMode;
  snapDivRef.current = snapDiv;
  scaleRef.current = scaleHighlight;
  metroRef.current = metronome;

  mutedRef.current = muted;
  soloedRef.current = soloed;
  loopRef.current = loop;

  /* ---------- load + parse ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(String(res.status));
        const parsed = parseMidi(await res.arrayBuffer());
        if (!alive) return;
        if (!parsed) {
          setStatus("error");
          return;
        }
        dataRef.current = parsed;
        const k = detectKey(parsed);
        autoKeyRef.current = k;
        keyRef.current = k;
        setDetectedKey(k);
        setData(parsed);
        setStatus("ready");
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [src]);

  /* ---------- drawing ---------- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const ppt = pxPerTickRef.current;
    if (!Number.isFinite(ppt) || ppt <= 0 || w <= 0 || h <= 0) return;
    const view0 = scrollRef.current;
    const plotW = Math.max(1, w - KEYS_W - SCROLL_W);
    const plotH = Math.max(1, h - RULER_H - VEL_H - SCROLL_H);
    const view1 = view0 + plotW / ppt;
    if (!Number.isFinite(view0) || !Number.isFinite(view1)) return;
    const rowH = rowHRef.current;
    const vs = Math.round(vScrollRef.current);
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    const hair = dpr >= 2 ? 1 : 1 / dpr;
    const yFor = (p: number) => RULER_H + (d.hiPitch - p) * rowH - vs;
    const xFor = (t: number) => KEYS_W + (t - view0) * ppt;
    const sx = (t: number) => snap(xFor(t));
    const isBlack = (p: number) => BLACK_PC.has(p % 12);
    const pTop = Math.min(d.hiPitch, d.hiPitch - Math.floor(vs / rowH));
    const pBot = Math.max(d.loPitch, d.hiPitch - Math.ceil((vs + plotH) / rowH));

    /* plot background + row striping */
    ctx.fillStyle = "#0e0e12";
    ctx.fillRect(KEYS_W, RULER_H, plotW, plotH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYS_W, RULER_H, plotW, plotH);
    ctx.clip();

    const key = keyRef.current;
    const showScale = scaleRef.current && !!key;
    for (let p = pBot; p <= pTop; p++) {
      const y = snap(yFor(p));
      const rh = snap(yFor(p) + rowH) - y;
      ctx.fillStyle = isBlack(p) ? "#0e0e12" : "#191920";
      ctx.fillRect(KEYS_W, y, plotW, rh);
      if (showScale && key.pcs.has(p % 12)) {
        ctx.fillStyle = "rgba(255,255,255,0.045)";
        ctx.fillRect(KEYS_W, y, plotW, rh);
        if (p % 12 === key.tonic) {
          ctx.fillStyle = "rgba(251,191,36,0.5)";
          ctx.fillRect(KEYS_W, y, plotW, hair);
        }
      }
      ctx.fillStyle = p % 12 === 11 ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.5)";
      ctx.fillRect(KEYS_W, y + rh - hair, plotW, hair);
    }
    ctx.restore();

    const beat = Math.max(1, d.ppq);
    const bar = beat * Math.max(1, d.beatsPerBar);
    const sixteenth = Math.max(1, Math.round(beat / 4));
    const beatPx = beat * ppt;
    const barPx = bar * ppt;

    /* alternating bar shading, so the time axis reads without counting */
    if (barPx >= 24) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(KEYS_W, RULER_H, plotW, plotH);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.022)";
      let guard = Math.ceil(plotW / barPx) + 2;
      for (let t = Math.floor(view0 / bar) * bar; t <= view1 && guard > 0; t += bar, guard--) {
        if (t < 0) continue;
        if (Math.round(t / bar) % 2 !== 1) continue;
        const x = sx(t);
        ctx.fillRect(x, RULER_H, sx(t + bar) - x, plotH);
      }
      ctx.restore();
    }

    /* ruler strip */
    ctx.fillStyle = "#16161b";
    ctx.fillRect(0, 0, w, RULER_H);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, RULER_H - hair, w, hair);

    const step = sixteenth * ppt >= 15 ? sixteenth : beatPx > 11 ? beat : bar;
    const labelEvery = barPx > 44 ? bar : bar * Math.ceil(48 / Math.max(1, barPx));
    ctx.font = "500 10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    if (step * ppt >= 2) {
      let guard = Math.ceil(plotW / (step * ppt)) + 2;
      for (let t = Math.floor(view0 / step) * step; t <= view1 && guard > 0; t += step, guard--) {
        if (t < 0) continue;
        const x = sx(t);
        const isBar = t % bar === 0;
        const isBeat = t % beat === 0;
        ctx.fillStyle = isBar
          ? "rgba(255,255,255,0.13)"
          : isBeat
            ? editRef.current
              ? "rgba(255,255,255,0.085)"
              : "rgba(255,255,255,0.05)"
            : editRef.current
              ? "rgba(255,255,255,0.045)"
              : "rgba(255,255,255,0.022)";
        ctx.fillRect(x, RULER_H, hair, plotH);
        if (isBeat) {
          ctx.fillStyle = isBar ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)";
          ctx.fillRect(x, RULER_H - (isBar ? 9 : 4), hair, isBar ? 9 : 4);
        }
        if (isBar && t % labelEvery === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.fillText(String(Math.round(t / bar) + 1), x + 5, RULER_H / 2 - 1);
        }
      }
    }

    /* loop region */
    const region = loopRegionRef.current;
    if (region) {
      const ax = xFor(region.a);
      const bx = xFor(region.b);
      ctx.fillStyle = "rgba(45,212,191,0.035)";
      ctx.fillRect(snap(ax), RULER_H, snap(bx) - snap(ax), plotH);
      ctx.fillStyle = "rgba(45,212,191,0.22)";
      ctx.fillRect(snap(ax), 0, snap(bx) - snap(ax), RULER_H - 1);
      ctx.fillStyle = "rgba(45,212,191,0.75)";
      ctx.fillRect(snap(ax), 0, hair, RULER_H + plotH);
      ctx.fillRect(snap(bx) - hair, 0, hair, RULER_H + plotH);
    }

    if (editRef.current) {
      ctx.fillStyle = "rgba(251,191,36,0.55)";
      ctx.fillRect(KEYS_W, RULER_H, plotW, hair * 2);
    }

    /* notes */
    const now = posRef.current;
    const solo = soloedRef.current;
    const mute = mutedRef.current;
    const noteH = Math.max(2.5, rowH - 5);
    const totalNotes = d.tracks.reduce((s, t) => s + t.notes.length, 0);
    const stride = Math.max(1, Math.ceil(totalNotes / 25000));
    const fancy = totalNotes <= 6000;
    const showLabels = editRef.current && noteH >= 12;
    const activePitches = new Set<number>();
    const velNotes: { x: number; v: number; color: string; active: boolean }[] = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYS_W, RULER_H, plotW, plotH);
    ctx.clip();

    d.tracks.forEach((track, ti) => {
      const audible = solo.size > 0 ? solo.has(ti) : !mute.has(ti);
      const ramp = rampFor(track.color);

      let i = lowerBound(track.notes, view0 - track.maxDur);
      for (; i < track.notes.length; i += stride) {
        const n = track.notes[i];
        if (n.t > view1) break;
        if (n.t + n.d < view0) continue;
        const x = sx(n.t);
        const nw = Math.max(hair * 2, sx(n.t + n.d) - x - hair);
        const y = snap(yFor(n.p) + (rowH - noteH) / 2);
        const nh = Math.max(hair * 2, snap(yFor(n.p) + (rowH - noteH) / 2 + noteH) - y);
        const active = audible && playingRef.current && now >= n.t && now < n.t + n.d;
        if (active) activePitches.add(n.p);

        ctx.globalAlpha = audible ? 1 : 0.13;
        if (active && fancy) {
          ctx.shadowColor = track.bright;
          ctx.shadowBlur = 8;
        }
        ctx.fillStyle = active ? track.bright : ramp[(n.v * 8) | 0];
        ctx.fillRect(x, y, nw, nh);
        ctx.shadowBlur = 0;

        if (nh >= 5 && nw >= 3) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(x, y + nh - hair, nw, hair);
          ctx.fillRect(x + nw - hair, y, hair, nh);
          ctx.fillStyle = active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)";
          ctx.fillRect(x, y, nw, hair);
          ctx.fillRect(x, y, hair, nh);
        }

        if (showScale && !track.percussion && !key.pcs.has(n.p % 12) && audible) {
          const ow = hair * 2;
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x, y, nw, nh);
          ctx.fillStyle = active ? track.bright : ramp[(n.v * 8) | 0];
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x, y, nw, nh);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fb7185";
          ctx.fillRect(x, y, nw, ow);
          ctx.fillRect(x, y + nh - ow, nw, ow);
          ctx.fillRect(x, y, ow, nh);
          ctx.fillRect(x + nw - ow, y, ow, nh);
        }

        if (showLabels && audible) {
          const label = NAMES[n.p % 12] + (Math.floor(n.p / 12) - 1);
          if (nw >= label.length * 6.5 + 10) {
            ctx.globalAlpha = active ? 1 : 0.8;
            ctx.fillStyle = "rgba(18,12,2,0.85)";
            ctx.font = "500 9.5px ui-monospace, monospace";
            ctx.fillText(label, x + 5, y + nh / 2 + 0.5);
          }
        }
        if (audible) velNotes.push({ x, v: n.v, color: track.color, active });
      }
    });
    ctx.globalAlpha = 1;

    const sel = selectedRef.current;
    if (sel && editRef.current) {
      const x = xFor(sel.t);
      const nw = Math.max(2, sel.d * ppt - 0.75);
      const y = yFor(sel.p) + (rowH - noteH) / 2;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, nw + 2, noteH + 2, 2);
      ctx.stroke();
    }

    /* playhead */
    const px = sx(now);
    if (px >= KEYS_W - 1 && px <= w + 1) {
      ctx.fillStyle = "rgba(251,191,36,0.9)";
      ctx.fillRect(px, RULER_H, hair, plotH);
    }
    ctx.restore();

    /* velocity lane */
    const velTop = RULER_H + plotH;
    ctx.fillStyle = "#0c0c10";
    ctx.fillRect(0, velTop, w, VEL_H);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, velTop, w, hair);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = "500 8.5px ui-monospace, monospace";
    ctx.fillText("VEL", 7, velTop + 10);
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYS_W, velTop + 1, plotW, VEL_H - 1);
    ctx.clip();
    const velStride = Math.max(1, Math.ceil(velNotes.length / 3000));
    const stemW = Math.max(hair, snap(2));
    for (let vi = 0; vi < velNotes.length; vi += velStride) {
      const vn = velNotes[vi];
      const stem = snap(4 + vn.v * (VEL_H - 10));
      ctx.fillStyle = vn.color;
      ctx.globalAlpha = vn.active ? 1 : 0.55;
      ctx.fillRect(vn.x, velTop + VEL_H - stem, stemW, stem);
    }
    ctx.globalAlpha = 1;
    if (px >= KEYS_W - 1 && px <= w + 1) {
      ctx.fillStyle = "rgba(251,191,36,0.35)";
      ctx.fillRect(px, velTop + 1, hair, VEL_H - 1);
    }
    ctx.restore();

    if (px >= KEYS_W - 8 && px <= w + 8) {
      ctx.fillStyle = "rgba(251,191,36,0.95)";
      ctx.beginPath();
      ctx.moveTo(px - 5, 2);
      ctx.lineTo(px + 5 + hair, 2);
      ctx.lineTo(px + 5 + hair, RULER_H - 9);
      ctx.lineTo(px + hair / 2, RULER_H - 2);
      ctx.lineTo(px - 5, RULER_H - 9);
      ctx.closePath();
      ctx.fill();
    }

    /* piano keyboard gutter — FL-style 3D keys */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, RULER_H, KEYS_W, plotH);
    ctx.clip();
    ctx.fillStyle = "#0b0b0d";
    ctx.fillRect(0, RULER_H, KEYS_W, plotH);

    const inRange = (p: number) => p >= d.loPitch && p <= d.hiPitch;
    const whiteW = KEYS_W - 2;
    const whiteGrad = ctx.createLinearGradient(0, 0, whiteW, 0);
    whiteGrad.addColorStop(0, "#b9b9c0");
    whiteGrad.addColorStop(0.14, "#e4e4e8");
    whiteGrad.addColorStop(1, "#fafafb");
    const whiteLit = ctx.createLinearGradient(0, 0, whiteW, 0);
    whiteLit.addColorStop(0, "#b45309");
    whiteLit.addColorStop(0.25, "#f59e0b");
    whiteLit.addColorStop(1, "#fde68a");

    /* one continuous white strip, black keys sit on top of it */
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, RULER_H, whiteW, plotH);

    const whiteTop = (p: number) =>
      snap(yFor(p) - (inRange(p + 1) && isBlack(p + 1) ? rowH / 2 : 0));
    const whiteBot = (p: number) =>
      snap(yFor(p) + rowH + (inRange(p - 1) && isBlack(p - 1) ? rowH / 2 : 0));

    for (let p = pBot - 1; p <= pTop + 1; p++) {
      if (!inRange(p) || isBlack(p)) continue;
      if (!activePitches.has(p)) continue;
      const top = whiteTop(p);
      ctx.fillStyle = whiteLit;
      ctx.fillRect(0, top, whiteW, whiteBot(p) - top);
    }

    for (let p = pBot - 1; p <= pTop + 1; p++) {
      if (!inRange(p) || isBlack(p)) continue;
      const lit = activePitches.has(p);
      const top = whiteTop(p);
      const bottom = whiteBot(p);
      ctx.fillStyle = "rgba(60,60,70,0.6)";
      ctx.fillRect(0, bottom - hair, whiteW, hair);
      const isC = p % 12 === 0;
      if (rowH >= 12) {
        ctx.fillStyle = lit ? "rgba(60,30,0,0.85)" : isC ? "#3a3a42" : "rgba(90,90,100,0.7)";
        ctx.font = `${isC ? 600 : 400} ${isC ? 10 : 9}px ui-monospace, monospace`;
        ctx.textAlign = "right";
        ctx.fillText(NAMES[p % 12] + (Math.floor(p / 12) - 1), whiteW - 5, (top + bottom) / 2 + 0.5);
        ctx.textAlign = "left";
      }
    }

    const bw = snap(Math.round(KEYS_W * 0.6));
    for (let p = pBot - 1; p <= pTop + 1; p++) {
      if (!inRange(p) || !isBlack(p)) continue;
      const lit = activePitches.has(p);
      const y = snap(yFor(p) + 1);
      const bh = snap(yFor(p) + rowH) - y;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, y + bh, bw + snap(2), hair * 2);
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      if (lit) {
        g.addColorStop(0, "#fbbf24");
        g.addColorStop(1, "#b45309");
      } else {
        g.addColorStop(0, "#3d3d45");
        g.addColorStop(0.6, "#1d1d22");
        g.addColorStop(1, "#0d0d10");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, y, bw, bh);
      ctx.fillStyle = lit ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)";
      ctx.fillRect(0, y, bw - hair, hair);
    }
    ctx.restore();
    ctx.fillStyle = "#000000";
    ctx.fillRect(KEYS_W - snap(2), RULER_H, snap(2), plotH);

    /* scrollbars */
    const contentH = (d.hiPitch - d.loPitch + 1) * rowH;
    const viewTicks = plotW / ppt;
    ctx.fillStyle = "#0c0c10";
    ctx.fillRect(w - SCROLL_W, RULER_H, SCROLL_W, plotH);
    ctx.fillRect(0, h - SCROLL_H, w, SCROLL_H);

    const thumb = (bx: number, by: number, bw2: number, bh2: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.roundRect(snap(bx), snap(by), Math.max(2, snap(bw2)), Math.max(2, snap(bh2)), 2);
      ctx.fill();
    };

    if (contentH > plotH + 1) {
      const th = Math.max(26, (plotH / contentH) * plotH);
      const ty = RULER_H + (vs / Math.max(1, contentH - plotH)) * (plotH - th);
      thumb(w - SCROLL_W + 2, ty, SCROLL_W - 4, th);
    }
    if (d.durationTicks > viewTicks + 1) {
      const tw = Math.max(26, (viewTicks / d.durationTicks) * plotW);
      const tx = KEYS_W + (view0 / Math.max(1, d.durationTicks - viewTicks)) * (plotW - tw);
      thumb(tx, h - SCROLL_H + 2, tw, SCROLL_H - 4);
    }
  }, []);

  /* ---------- Ctrl+wheel: stop the browser zooming the page ---------- */
  useEffect(() => {
    if (status !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const block = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    canvas.addEventListener("wheel", block, { passive: false });
    return () => canvas.removeEventListener("wheel", block);
  }, [status]);

  /* ---------- rAF loop ---------- */
  useEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    const tick = () => {
      const d = dataRef.current;
      const eng = engineRef.current;
      if (d && playingRef.current && eng) {
        posRef.current = Math.min(eng.transport.ticks, d.durationTicks);
        const canvas = canvasRef.current;
        if (canvas) {
          const w = canvas.width / (window.devicePixelRatio || 1);
          const viewTicks = Math.max(1, w - KEYS_W - SCROLL_W) / pxPerTickRef.current;
          if (followRef.current && posRef.current > scrollRef.current + viewTicks * FOLLOW_AT) {
            scrollRef.current = clampScroll(
              posRef.current - viewTicks * FOLLOW_TO,
              d,
              viewTicks
            );
          }
        }
        syncTimeUi();
        dirtyRef.current = true;
      }
      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const syncTimeUi = () => {
    const d = dataRef.current;
    if (!d) return;
    const bpm = d.baseBpm * (tempoRef.current / 100);
    const toSec = (ticks: number) => (ticks / d.ppq) * (60 / bpm);
    if (timeRef.current) {
      timeRef.current.textContent = `${fmtTime(toSec(posRef.current))} / ${fmtTime(
        toSec(d.durationTicks)
      )}`;
    }
    if (seekRef.current && !seekingRef.current) {
      const pct = (posRef.current / d.durationTicks) * 100;
      seekRef.current.value = String(Math.round(pct * 10));
      seekRef.current.style.setProperty("--p", `${pct}%`);
    }
  };

  useEffect(() => {
    if (status === "ready") syncTimeUi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* ---------- piano samples, on first interaction ----------
     Twenty-nine mp3s from a third-party host, several megabytes of
     them, used to start downloading the instant a result rendered —
     whether or not anyone ever pressed play. Now the first pointer or
     key near the player triggers it, which still lands well before the
     samples are needed and costs nothing for the people who just want
     to download the file. */
  useEffect(() => {
    if (status !== "ready") return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    let done = false;
    const warm = () => {
      if (done) return;
      done = true;
      prefetchPiano();
    };
    wrap.addEventListener("pointerenter", warm, { once: true });
    wrap.addEventListener("pointerdown", warm, { once: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      wrap.removeEventListener("pointerenter", warm);
      wrap.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [status]);

  /* ---------- canvas sizing ---------- */
  useEffect(() => {
    if (status !== "ready") return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!wrap || !canvas || !d) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      if (!w) return;
      const rows = d.hiPitch - d.loPitch + 1;
      const maxPlot = CANVAS_MAX_H - RULER_H - VEL_H - SCROLL_H;
      const rowH = Math.round(Math.max(ROW_MIN, Math.min(ROW_MAX, maxPlot / rows)));
      rowHRef.current = rowH;
      const contentH = rows * rowH;
      const h = Math.min(CANVAS_MAX_H, Math.max(300, contentH + RULER_H + VEL_H + SCROLL_H));
      const plotH = h - RULER_H - VEL_H - SCROLL_H;
      const maxV = Math.max(0, contentH - plotH);
      if (!vInitRef.current) {
        vInitRef.current = true;
        let sum = 0;
        let cnt = 0;
        for (const t of d.tracks) for (const n of t.notes) { sum += n.p; cnt++; }
        const mid = cnt ? sum / cnt : (d.hiPitch + d.loPitch) / 2;
        vScrollRef.current = (d.hiPitch - mid) * rowH - plotH / 2;
      }
      vScrollRef.current = Math.max(0, Math.min(maxV, vScrollRef.current));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const plotWNow = Math.max(1, w - KEYS_W - SCROLL_W);
      minZoomRef.current = plotWNow / d.durationTicks;
      if (
        !Number.isFinite(pxPerTickRef.current) ||
        pxPerTickRef.current <= 0 ||
        pxPerTickRef.current < minZoomRef.current
      ) {
        const openTicks = Math.min(d.durationTicks, d.ppq * d.beatsPerBar * 4);
        pxPerTickRef.current = Math.max(minZoomRef.current, plotWNow / openTicks);
        scrollRef.current = 0;
      }
      dirtyRef.current = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [status]);

  /* ---------- engine ---------- */
  const ensureEngine = async (): Promise<Engine> => {
    if (engineRef.current) return engineRef.current;
    const d = dataRef.current!;
    const Tone = await import("tone");
    await Tone.start();

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.PPQ = d.ppq;
    transport.bpm.value = d.baseBpm * (tempoRef.current / 100);
    transport.loop = loopRef.current;
    transport.loopStart = `${loopRegionRef.current ? loopRegionRef.current.a : 0}i`;
    transport.loopEnd = `${loopRegionRef.current ? loopRegionRef.current.b : d.durationTicks}i`;

    const limiter = new Tone.Limiter(-1).toDestination();
    const midiGain = new Tone.Gain(mixGains(mixRef.current, compareRef.current).midi).connect(limiter);
    const origGain = new Tone.Gain(mixGains(mixRef.current, compareRef.current).orig).connect(limiter);
    const master = new Tone.Volume(-6).connect(midiGain);

    const synths: Engine["synths"] = [];
    const channels: Engine["channels"] = [];
    const parts: Engine["parts"] = [];

    const eng: Engine = {
      Tone,
      transport,
      synths,
      channels,
      parts,
      nodes: [limiter, master, midiGain, origGain],
      midiGain,
      origGain,
      original: null,
    };

    d.tracks.forEach((track, ti) => {
      const channel = new Tone.Channel({
        mute: mutedRef.current.has(ti),
        solo: soloedRef.current.has(ti),
      }).connect(master);
      channels.push(channel);

      const part = new Tone.Part(
        (time, ev: PlayerNote) => {
          const bpmNow = transport.bpm.value;
          const durSec = Math.max(MIN_NOTE_SEC, (ev.d / d.ppq) * (60 / bpmNow));
          eng.synths[ti]?.triggerAttackRelease(
            Tone.Frequency(ev.p, "midi").toFrequency(),
            durSec,
            time,
            0.25 + ev.v * 0.75
          );
        },
        track.notes.map((n) => [`${n.t}i`, n] as [string, PlayerNote])
      ).start(0);
      parts.push(part);
    });

    loadInstruments(eng, instrumentRef.current);

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
      const barLen = d.ppq * d.beatsPerBar;
      const accent = Math.abs(ticks % barLen) < d.ppq / 2;
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

    let lastTicks = 0;
    transport.scheduleRepeat(
      () => {
        if (loopRef.current && transport.ticks < lastTicks - d.ppq / 2) {
          posRef.current = transport.ticks;
          startOriginal(eng);
        }
        lastTicks = transport.ticks;
        if (!loopRef.current && transport.ticks >= d.durationTicks - 1) {
          transport.pause();
          synths.forEach((s) => s.releaseAll());
          stopOriginal(eng);
          playingRef.current = false;
          setIsPlaying(false);
          posRef.current = 0;
          transport.ticks = 0;
          syncTimeUi();
          dirtyRef.current = true;
        }
      },
      0.05,
      0
    );

    engineRef.current = eng;
    return eng;
  };

  const loadInstruments = (eng: Engine, kind: InstrumentKind) => {
    const d = dataRef.current;
    if (!d) return;
    eng.synths.forEach((s) => {
      s.releaseAll();
      s.dispose();
    });
    eng.synths.length = 0;
    let pending = d.tracks.length;
    setInstrumentLoading(true);

    let settle: () => void = () => {};
    let done = false;
    instrReadyRef.current = new Promise<void>((res) => {
      settle = () => {
        if (done) return;
        done = true;
        setInstrumentLoading(false);
        res();
      };
    });
    const bail = window.setTimeout(settle, 10000);
    const finish = () => {
      window.clearTimeout(bail);
      settle();
    };

    if (!pending) {
      finish();
      return;
    }
    d.tracks.forEach((track, ti) => {
      const inst = makeInstrument(eng.Tone, kind, track.percussion, () => {
        pending -= 1;
        if (pending <= 0) finish();
      });
      inst.connect(eng.channels[ti]);
      eng.synths[ti] = inst;
    });
  };

  const originalOffsetSec = () => {
    const d = dataRef.current;
    if (!d) return 0;
    return (posRef.current / d.ppq) * (60 / d.baseBpm);
  };

  const startOriginal = (eng: Engine, when?: string) => {
    const p = eng.original;
    if (!p || !p.loaded) return;
    try {
      p.stop();
    } catch {}
    const off = originalOffsetSec();
    if (off < p.buffer.duration) p.start(when, off);
  };

  const stopOriginal = (eng: Engine | null) => {
    const p = eng?.original;
    if (!p) return;
    try {
      p.stop();
    } catch {}
  };

  useEffect(() => {
    return () => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.transport.stop();
      eng.transport.cancel();
      eng.transport.loop = false;
      eng.parts.forEach((p) => p.dispose());
      eng.synths.forEach((s) => s.dispose());
      eng.channels.forEach((c) => {
        c.solo = false;
        c.dispose();
      });
      eng.nodes.forEach((n) => n.dispose());
      eng.original?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* ---------- source file object URL ---------- */
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
      eng.synths.forEach((s) => s.releaseAll());
      stopOriginal(eng);
      playingRef.current = false;
      setIsPlaying(false);
    } else {
      if (instrReadyRef.current) await instrReadyRef.current;
      if (playingRef.current) return;
      followRef.current = true;
      const lead = "+0.15";
      eng.transport.ticks = posRef.current;
      eng.transport.start(lead);
      startOriginal(eng, lead);
      playingRef.current = true;
      setIsPlaying(true);
    }
  };

  const stop = () => {
    const eng = engineRef.current;
    if (eng) {
      eng.transport.pause();
      eng.transport.ticks = 0;
      eng.synths.forEach((s) => s.releaseAll());
      stopOriginal(eng);
    }
    playingRef.current = false;
    setIsPlaying(false);
    posRef.current = 0;
    scrollRef.current = 0;
    syncTimeUi();
    dirtyRef.current = true;
  };

  const seekTo = (ticks: number) => {
    const d = dataRef.current;
    if (!d) return;
    followRef.current = true;
    const t = Math.max(0, Math.min(d.durationTicks, ticks));
    posRef.current = t;
    const eng = engineRef.current;
    if (eng) {
      eng.synths.forEach((s) => s.releaseAll());
      eng.transport.ticks = t;
      if (playingRef.current) startOriginal(eng);
    }
    syncTimeUi();
    dirtyRef.current = true;
  };

  const setTempo = (raw: number) => {
    const pct = Math.max(50, Math.min(150, Math.round(raw / 5) * 5));
    tempoRef.current = pct;
    setTempoPct(pct);
    const eng = engineRef.current;
    const d = dataRef.current;
    if (eng && d) {
      eng.transport.bpm.value = d.baseBpm * (pct / 100);
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

  const changeInstrument = (kind: InstrumentKind) => {
    instrumentRef.current = kind;
    setInstrument(kind);
    const eng = engineRef.current;
    if (eng) loadInstruments(eng, kind);
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

  const toggleLoop = () => {
    const next = !loopRef.current;
    loopRef.current = next;
    setLoop(next);
    const eng = engineRef.current;
    if (eng) eng.transport.loop = next;
    if (!next && loopRegionRef.current) {
      loopRegionRef.current = null;
      setLoopRegion(null);
      const d = dataRef.current;
      if (eng && d) {
        eng.transport.loopStart = 0;
        eng.transport.loopEnd = `${d.durationTicks}i`;
      }
      dirtyRef.current = true;
    }
  };

  const toggleMute = (ti: number) => {
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(ti)) next.delete(ti);
      else next.add(ti);
      engineRef.current?.channels[ti] &&
        (engineRef.current.channels[ti].mute = next.has(ti));
      dirtyRef.current = true;
      return next;
    });
  };

  const toggleSolo = (ti: number) => {
    setSoloed((prev) => {
      const next = new Set(prev);
      if (next.has(ti)) next.delete(ti);
      else next.add(ti);
      engineRef.current?.channels.forEach((c, i) => (c.solo = next.has(i)));
      dirtyRef.current = true;
      return next;
    });
  };

  /* ---------- editing ---------- */
  const geom = () => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const plotW = Math.max(1, w - KEYS_W - SCROLL_W);
    const plotH = Math.max(1, h - RULER_H - VEL_H - SCROLL_H);
    const rowH = rowHRef.current;
    const ppt = pxPerTickRef.current;
    return {
      d,
      w,
      h,
      plotW,
      plotH,
      rowH,
      ppt,
      tickAt: (lx: number) => scrollRef.current + lx / ppt,
      pitchAt: (ly: number) =>
        Math.max(
          d.loPitch,
          Math.min(d.hiPitch, d.hiPitch - Math.floor((ly - RULER_H + vScrollRef.current) / rowH))
        ),
      inPlot: (lx: number, ly: number) => lx >= 0 && ly >= RULER_H && ly < RULER_H + plotH,
    };
  };

  const gridStep = () => {
    const ppq = dataRef.current?.ppq ?? 480;
    const div = snapDivRef.current || 16;
    return Math.max(1, Math.round((ppq * 4) / div));
  };
  const snapTick = (t: number) => {
    if (!snapDivRef.current) return Math.max(0, Math.round(t));
    const st = gridStep();
    return Math.max(0, Math.round(t / st) * st);
  };

/**
 * Runs on EVERY pointermove, in select mode as well as draw mode, purely
 * to drive the hover tooltip. It used to walk every note of every track
 * each time — on a five-track full-mix result that is tens of thousands
 * of comparisons per mouse move, and it is the main reason the roll felt
 * sticky on a dense file.
 *
 * Notes are sorted by start tick and no note lasts longer than its
 * track's maxDur, so nothing before lowerBound(tick - maxDur) can still
 * be sounding. Same answer, bounded work: the scan still keeps the LAST
 * match in a track, which is what the old backwards loop returned.
 */
  const hitNote = (tick: number, pitch: number, ppt: number) => {
    const d = dataRef.current;
    if (!d) return null;
    for (let ti = d.tracks.length - 1; ti >= 0; ti--) {
      const track = d.tracks[ti];
      const notes = track.notes;
      let found: { note: PlayerNote; ti: number; edge: boolean } | null = null;
      for (let i = lowerBound(notes, tick - track.maxDur); i < notes.length; i++) {
        const n = notes[i];
        if (n.t > tick) break;
        if (n.p !== pitch) continue;
        if (tick <= n.t + n.d) {
          const edgePx = (n.t + n.d - tick) * ppt;
          found = { note: n, ti, edge: edgePx <= Math.min(8, Math.max(3, n.d * ppt * 0.3)) };
        }
      }
      if (found) return found;
    }
    return null;
  };

  const pushHistory = () => {
    const d = dataRef.current;
    if (!d) return;
    historyRef.current.push(snapshotOf(d));
    if (historyRef.current.length > 60) historyRef.current.shift();
    redoRef.current = [];
    setHistoryLen(historyRef.current.length);
    setRedoLen(0);
  };

  const eraseAt = (tick: number, pitch: number, ppt: number, first: boolean) => {
    const d = dataRef.current;
    if (!d) return false;
    const hit = hitNote(tick, pitch, ppt);
    if (!hit) return false;
    if (first) pushHistory();
    const notes = d.tracks[hit.ti].notes;
    const at = notes.indexOf(hit.note);
    if (at < 0) return false;
    notes.splice(at, 1);
    if (selectedRef.current === hit.note) selectedRef.current = null;
    return true;
  };

  const afterEdit = () => {
    const d = dataRef.current;
    if (!d) return;
    d.tracks.forEach((t) => {
      t.notes.sort((a, b) => a.t - b.t);
      t.maxDur = t.notes.reduce((m, n) => Math.max(m, n.d), 1);
    });
    recomputeExtent(d);
    const eng = engineRef.current;
    if (eng) {
      if (!loopRegionRef.current) eng.transport.loopEnd = `${d.durationTicks}i`;
      rebuildParts(eng);
    }
    autoKeyRef.current = detectKey(d);
    if (keyOverride === "auto") {
      keyRef.current = autoKeyRef.current;
      setDetectedKey(keyRef.current);
    }
    dirtyRef.current = true;
    syncTimeUi();
  };

  const selectKey = (value: string) => {
    setKeyOverride(value);
    if (value === "auto") {
      keyRef.current = autoKeyRef.current;
    } else {
      const [tonic, mode] = value.split(":");
      keyRef.current = keyFor(Number(tonic), mode as "major" | "minor");
    }
    setDetectedKey(keyRef.current);
    if (keyRef.current && !scaleRef.current) {
      scaleRef.current = true;
      setScaleHighlight(true);
    }
    dirtyRef.current = true;
  };

  const rebuildParts = (eng: Engine) => {
    const d = dataRef.current;
    if (!d) return;
    eng.parts.forEach((p) => p.dispose());
    eng.parts.length = 0;
    d.tracks.forEach((track, ti) => {
      const part = new eng.Tone.Part(
        (time, ev: PlayerNote) => {
          const bpmNow = eng.transport.bpm.value;
          const durSec = Math.max(MIN_NOTE_SEC, (ev.d / d.ppq) * (60 / bpmNow));
          eng.synths[ti]?.triggerAttackRelease(
            eng.Tone.Frequency(ev.p, "midi").toFrequency(),
            durSec,
            time,
            0.25 + ev.v * 0.75
          );
        },
        track.notes.map((n) => [`${n.t}i`, n] as [string, PlayerNote])
      ).start(0);
      eng.parts.push(part);
    });
  };

  const undo = () => {
    const d = dataRef.current;
    const snap = historyRef.current.pop();
    if (!d || !snap) return;
    redoRef.current.push(snapshotOf(d));
    restoreSnapshot(d, snap);
    selectedRef.current = null;
    setHistoryLen(historyRef.current.length);
    setRedoLen(redoRef.current.length);
    afterEdit();
  };

  const redo = () => {
    const d = dataRef.current;
    const snap = redoRef.current.pop();
    if (!d || !snap) return;
    historyRef.current.push(snapshotOf(d));
    restoreSnapshot(d, snap);
    selectedRef.current = null;
    setHistoryLen(historyRef.current.length);
    setRedoLen(redoRef.current.length);
    afterEdit();
  };

  const deleteSelected = () => {
    const d = dataRef.current;
    const sel = selectedRef.current;
    if (!d || !sel) return;
    pushHistory();
    for (const t of d.tracks) {
      const i = t.notes.indexOf(sel);
      if (i >= 0) t.notes.splice(i, 1);
    }
    selectedRef.current = null;
    afterEdit();
  };

  const auditionPitch = async (pitch: number, ti: number) => {
    if (playingRef.current) return;
    const eng = engineRef.current ?? (await ensureEngine());
    const inst = eng.synths[ti];
    if (!inst) return;
    inst.triggerAttackRelease(
      eng.Tone.Frequency(pitch, "midi").toFrequency(),
      0.18,
      eng.Tone.now(),
      0.6
    );
  };

  const exportEdited = () => {
    const d = dataRef.current;
    if (!d) return;
    const bytes = buildMidiFile(d);
    const blob = new Blob([bytes as BlobPart], { type: "audio/midi" });
    const base = (sourceFile?.name ?? "transcription").replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${base} (Forge Roll edit).mid`;
    // Attached to the DOM and revoked on a later tick, deliberately.
    // Firefox ignores click() on a detached anchor, and revoking the
    // object URL synchronously after click() aborts the download in both
    // Firefox and older Safari — so "Save edits" did nothing there.
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };

  const setMode = (draw: boolean) => {
    if (editRef.current === draw) return;
    editRef.current = draw;
    setEditMode(draw);
    if (!draw) selectedRef.current = null;
    dirtyRef.current = true;
  };

  const closePanels = () => {
    setPanel(null);
    setCtxMenu(null);
  };

  const openPanel = async (which: "notes" | "help" | "compare") => {
    setCtxMenu(null);
    setPanel((cur) => (cur === which ? null : which));
    if (which === "compare" && !compareRef.current) {
      if (!engineRef.current) await ensureEngine();
      applyMix(0.5, true);
    }
  };

  const onCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (suppressMenuRef.current) {
      suppressMenuRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPanel(null);
    setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const gridStepOrMin = () => (snapDivRef.current ? gridStep() : Math.max(1, Math.round(gridStep() / 4)));

  const refreshKey = () => {
    const d = dataRef.current;
    if (!d) return;
    autoKeyRef.current = detectKey(d);
    if (keyOverride === "auto") {
      keyRef.current = autoKeyRef.current;
      setDetectedKey(keyRef.current);
    }
  };

  const quantizeAll = () => {
    const d = dataRef.current;
    if (!d) return;
    pushHistory();
    const st = gridStep();
    for (const t of d.tracks) {
      for (const n of t.notes) {
        n.t = Math.max(0, Math.round(n.t / st) * st);
        n.d = Math.max(st, Math.round(n.d / st) * st);
      }
    }
    afterEdit();
  };

  const transposeAll = (semis: number) => {
    const d = dataRef.current;
    if (!d) return;
    pushHistory();
    let lo = 127;
    let hi = 0;
    for (const t of d.tracks) {
      for (const n of t.notes) {
        if (!t.percussion) n.p = Math.max(0, Math.min(127, n.p + semis));
        lo = Math.min(lo, n.p);
        hi = Math.max(hi, n.p);
      }
    }
    d.loPitch = Math.max(0, lo - 2);
    d.hiPitch = Math.min(127, hi + 3);
    refreshKey();
    afterEdit();
  };

  const velocityTool = (mode: "flatten" | "humanize") => {
    const d = dataRef.current;
    if (!d) return;
    pushHistory();
    for (const t of d.tracks) {
      for (const n of t.notes) {
        n.v =
          mode === "flatten"
            ? 0.8
            : Math.max(0.15, Math.min(1, n.v + (Math.random() - 0.5) * 0.24));
      }
    }
    afterEdit();
  };

  const applyLoopRegion = (region: { a: number; b: number } | null) => {
    loopRegionRef.current = region;
    setLoopRegion(region);
    const eng = engineRef.current;
    const d = dataRef.current;
    if (eng && d) {
      eng.transport.loopStart = `${region ? region.a : 0}i`;
      eng.transport.loopEnd = `${region ? region.b : d.durationTicks}i`;
    }
    if (region && !loopRef.current) {
      loopRef.current = true;
      setLoop(true);
      if (eng) eng.transport.loop = true;
    }
    dirtyRef.current = true;
  };

  const toggleMetronome = async () => {
    const next = !metroRef.current;
    metroRef.current = next;
    setMetronome(next);
    if (next && !engineRef.current) await ensureEngine();
  };

  const toggleScale = () => {
    scaleRef.current = !scaleRef.current;
    setScaleHighlight(scaleRef.current);
    dirtyRef.current = true;
  };

  const noteInfo = (n: PlayerNote) => {
    const d = dataRef.current;
    if (!d) return "";
    const bar = Math.floor(n.t / (d.ppq * d.beatsPerBar)) + 1;
    const beatIn = ((n.t % (d.ppq * d.beatsPerBar)) / d.ppq + 1).toFixed(2).replace(/\.?0+$/, "");
    const lenBeats = n.d / d.ppq;
    const len = lenBeats >= 1 ? `${+lenBeats.toFixed(2)} beat${lenBeats >= 2 ? "s" : ""}` : `1/${Math.round(4 / lenBeats)}`;
    return `${NAMES[n.p % 12]}${Math.floor(n.p / 12) - 1} · bar ${bar} beat ${beatIn} · vel ${Math.round(n.v * 127)} · ${len}`;
  };

  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space" && tag !== "BUTTON") {
        e.preventDefault();
        void togglePlay();
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomBy(1.35);
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        zoomBy(1 / 1.35);
        return;
      }
      if (!editRef.current) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRef.current) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === "Escape") {
        selectedRef.current = null;
        dirtyRef.current = true;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!panel && !ctxMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null);
        setCtxMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, ctxMenu]);

  const scrollV = (dy: number) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const h = canvas.height / (window.devicePixelRatio || 1);
    const plotH = Math.max(1, h - RULER_H - VEL_H - SCROLL_H);
    const contentH = (d.hiPitch - d.loPitch + 1) * rowHRef.current;
    const maxV = Math.max(0, contentH - plotH);
    const next = Math.max(0, Math.min(maxV, vScrollRef.current + dy));
    if (next !== vScrollRef.current) {
      vScrollRef.current = next;
      dirtyRef.current = true;
    }
  };

  /* ---------- zoom + pan + click-seek ---------- */
  const zoomBy = (factor: number, anchorX?: number) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const plotW = Math.max(1, canvas.width / (window.devicePixelRatio || 1) - KEYS_W - SCROLL_W);
    const ax = Math.max(0, anchorX ?? plotW / 2);
    const old = pxPerTickRef.current;
    const anchorTick = scrollRef.current + ax / old;
    const maxZoom = plotW / (d.ppq * d.beatsPerBar);
    const next = Math.min(maxZoom, Math.max(minZoomRef.current, old * factor));
    pxPerTickRef.current = next;
    scrollRef.current = clampScroll(anchorTick - ax / next, d, plotW / next);
    dirtyRef.current = true;
  };

  const fitAll = () => {
    const d = dataRef.current;
    if (!d) return;
    pxPerTickRef.current = minZoomRef.current;
    scrollRef.current = 0;
    dirtyRef.current = true;
  };

  const pointer = useRef<{ x: number; y: number; startX: number; startY: number; panned: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (ctxMenu) setCtxMenu(null);
    if (e.button === 2) {
      suppressMenuRef.current = false;
      const g = geom();
      if (!g) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const ly = e.clientY - rect.top;
      if (ly < RULER_H) {
        if (loopRegionRef.current) applyLoopRegion(null);
        suppressMenuRef.current = true;
        return;
      }
      const lx = e.clientX - rect.left - KEYS_W;
      if (lx < 0 || lx > g.plotW || ly > RULER_H + g.plotH) return;
      if (eraseAt(g.tickAt(lx), g.pitchAt(ly), g.ppt, true)) {
        eraseRef.current = true;
        suppressMenuRef.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        afterEdit();
      }
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (e.pointerType === "touch") {
      pinchRef.current.set(e.pointerId, e.clientX);
      if (pinchRef.current.size === 2) {
        const [a, b] = [...pinchRef.current.values()];
        pinchDistRef.current = Math.abs(a - b);
        pointer.current = null;
        dragRef.current = null;
        return;
      }
    }
    {
      const g = geom();
      if (g) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        if (px >= g.w - SCROLL_W && py >= RULER_H && py < RULER_H + g.plotH) {
          scrollDragRef.current = { axis: "v", from: e.clientY, base: vScrollRef.current };
          return;
        }
        if (py >= g.h - SCROLL_H && px >= KEYS_W) {
          followRef.current = false;
          scrollDragRef.current = { axis: "h", from: e.clientX, base: scrollRef.current };
          return;
        }
      }
    }
    {
      const g = geom();
      if (g) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const lx = e.clientX - rect.left - KEYS_W;
        const ly = e.clientY - rect.top;
        if (ly < RULER_H && lx >= -KEYS_W) {
          const headX = (posRef.current - scrollRef.current) * g.ppt;
          const onHead = Math.abs(lx - headX) <= 9;
          rulerDragRef.current = {
            kind: onHead ? "scrub" : "region",
            anchor: g.tickAt(Math.max(0, lx)),
            moved: false,
          };
          if (onHead) seekTo(g.tickAt(Math.max(0, lx)));
          return;
        }
      }
    }
    if (editRef.current) {
      const g = geom();
      if (g) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const lx = e.clientX - rect.left - KEYS_W;
        const ly = e.clientY - rect.top;
        if (g.inPlot(lx, ly)) {
          const tick = g.tickAt(lx);
          const pitch = g.pitchAt(ly);
          const last = clickRef.current;
          const nowMs = e.timeStamp || performance.now();
          const isDouble =
            nowMs - last.t < 350 &&
            Math.abs(e.clientX - last.x) < 6 &&
            Math.abs(e.clientY - last.y) < 6;
          clickRef.current = { t: isDouble ? 0 : nowMs, x: e.clientX, y: e.clientY };

          const hit = hitNote(tick, pitch, g.ppt);
          if (hit) {
            if (isDouble) {
              pushHistory();
              const notes = g.d.tracks[hit.ti].notes;
              const at = notes.indexOf(hit.note);
              if (at >= 0) notes.splice(at, 1);
              selectedRef.current = null;
              afterEdit();
              return;
            }
            selectedRef.current = hit.note;
            dragRef.current = {
              kind: hit.edge ? "resize" : "move",
              note: hit.note,
              ti: hit.ti,
              startX: e.clientX,
              startY: e.clientY,
              orig: { ...hit.note },
              changed: false,
              lastPitch: hit.note.p,
            };
            void auditionPitch(hit.note.p, hit.ti);
            dirtyRef.current = true;
            return;
          }
          if (!isDouble) {
            pushHistory();
            const len = lastLenRef.current || gridStepOrMin();
            const note: PlayerNote = { t: snapTick(tick), d: len, p: pitch, v: 0.8 };
                    // findIndex returns -1 when every track is percussion, and
            // Math.max turned that into track 0 — dropping a pitched note
            // onto a drum track, which exports on channel 9.
            const melodic = g.d.tracks.findIndex((t) => !t.percussion);
            const ti = melodic >= 0 ? melodic : 0;
            g.d.tracks[ti].notes.push(note);
            selectedRef.current = note;
            dragRef.current = {
              kind: "resize",
              note,
              ti,
              startX: e.clientX,
              startY: e.clientY,
              orig: { ...note },
              changed: false,
              lastPitch: pitch,
            };
            void auditionPitch(pitch, ti);
            afterEdit();
            return;
          }
          selectedRef.current = null;
          dirtyRef.current = true;
        }
      }
    }
    pointer.current = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, panned: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (eraseRef.current) {
      const g = geom();
      if (!g) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const lx = e.clientX - rect.left - KEYS_W;
      const ly = e.clientY - rect.top;
      if (lx >= 0 && lx <= g.plotW && ly >= RULER_H && ly <= RULER_H + g.plotH) {
        if (eraseAt(g.tickAt(lx), g.pitchAt(ly), g.ppt, false)) afterEdit();
      }
      return;
    }
    const sd = scrollDragRef.current;
    if (sd) {
      const g = geom();
      if (!g) return;
      if (sd.axis === "v") {
        const contentH = (g.d.hiPitch - g.d.loPitch + 1) * g.rowH;
        const th = Math.max(26, (g.plotH / contentH) * g.plotH);
        const span = Math.max(1, g.plotH - th);
        const next = sd.base + ((e.clientY - sd.from) / span) * Math.max(0, contentH - g.plotH);
        vScrollRef.current = Math.max(0, Math.min(Math.max(0, contentH - g.plotH), next));
      } else {
        const viewTicks = g.plotW / g.ppt;
        const tw = Math.max(26, (viewTicks / g.d.durationTicks) * g.plotW);
        const span = Math.max(1, g.plotW - tw);
        const next =
          sd.base + ((e.clientX - sd.from) / span) * Math.max(0, g.d.durationTicks - viewTicks);
        scrollRef.current = clampScroll(next, g.d, viewTicks);
      }
      dirtyRef.current = true;
      return;
    }
    if (e.pointerType === "touch" && pinchRef.current.size === 2) {
      pinchRef.current.set(e.pointerId, e.clientX);
      const [a, b] = [...pinchRef.current.values()];
      const dist = Math.abs(a - b);
      if (pinchDistRef.current > 0 && dist > 0) {
        const rect = canvasRef.current?.getBoundingClientRect();
        const center = (a + b) / 2 - (rect?.left ?? 0) - KEYS_W;
        zoomBy(dist / pinchDistRef.current, center);
      }
      pinchDistRef.current = dist;
      return;
    }

    const rd = rulerDragRef.current;
    if (rd) {
      const g = geom();
      if (!g) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const lx = Math.max(0, e.clientX - rect.left - KEYS_W);
      const tick = g.tickAt(lx);
      if (rd.kind === "scrub") {
        seekTo(tick);
      } else {
        if (Math.abs(tick - rd.anchor) * g.ppt > 4) rd.moved = true;
        if (rd.moved) {
          const beat = g.d.ppq;
          const a = Math.max(0, Math.round(Math.min(rd.anchor, tick) / beat) * beat);
          const b = Math.min(g.d.durationTicks, Math.round(Math.max(rd.anchor, tick) / beat) * beat);
          if (b - a >= beat) applyLoopRegion({ a, b });
        }
      }
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      const g = geom();
      if (!g) return;
      const dxTicks = (e.clientX - drag.startX) / g.ppt;
      if (drag.kind === "move") {
        const dRows = Math.round((e.clientY - drag.startY) / g.rowH);
        const nextT = snapTick(drag.orig.t + dxTicks);
        const nextP = Math.max(g.d.loPitch, Math.min(g.d.hiPitch, drag.orig.p - dRows));
        if (nextT !== drag.note.t || nextP !== drag.note.p) {
          if (!drag.changed) {
            pushHistory();
            drag.changed = true;
          }
          drag.note.t = nextT;
          drag.note.p = nextP;
          if (nextP !== drag.lastPitch) {
            drag.lastPitch = nextP;
            void auditionPitch(nextP, drag.ti);
          }
          dirtyRef.current = true;
        }
      } else {
        const nextD = Math.max(gridStepOrMin(), snapTick(drag.orig.d + dxTicks));
        if (nextD !== drag.note.d) {
          if (!drag.changed) {
            pushHistory();
            drag.changed = true;
          }
          drag.note.d = nextD;
          dirtyRef.current = true;
        }
      }
      return;
    }

    if (!pointer.current) {
      const g = geom();
      const canvasEl = canvasRef.current;
      if (g && canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        const lx = e.clientX - rect.left - KEYS_W;
        const ly = e.clientY - rect.top;
        const hit = g.inPlot(lx, ly) ? hitNote(g.tickAt(lx), g.pitchAt(ly), g.ppt) : null;
        let cursor = editRef.current ? "crosshair" : "grab";
        if (ly < RULER_H) {
          const headX = (posRef.current - scrollRef.current) * g.ppt;
          cursor = Math.abs(lx - headX) <= 9 ? "ew-resize" : "text";
        } else if (hit && editRef.current) {
          cursor = hit.edge ? "ew-resize" : "move";
        } else if (hit) {
          cursor = "pointer";
        }
        canvasEl.style.cursor = cursor;
        const hn = hit?.note ?? null;
        if (hn !== hoverNoteRef.current) {
          hoverNoteRef.current = hn;
          setHover(hn ? { x: e.clientX - rect.left, y: ly, text: noteInfo(hn) } : null);
        } else if (hn && performance.now() - hoverTsRef.current > 50) {
          hoverTsRef.current = performance.now();
          setHover((prev) => (prev ? { ...prev, x: e.clientX - rect.left, y: ly } : prev));
        }
      }
    }

    const p = pointer.current;
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!p || !canvas || !d) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.abs(e.clientX - p.startX) > 4 || Math.abs(e.clientY - p.startY) > 4) p.panned = true;
    if (p.panned) {
      const plotW = Math.max(1, canvas.width / (window.devicePixelRatio || 1) - KEYS_W - SCROLL_W);
      followRef.current = false;
      scrollRef.current = clampScroll(
        scrollRef.current - dx / pxPerTickRef.current,
        d,
        plotW / pxPerTickRef.current
      );
      scrollV(-dy);
      dirtyRef.current = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (eraseRef.current) {
      eraseRef.current = false;
      return;
    }
    if (scrollDragRef.current) {
      scrollDragRef.current = null;
      return;
    }
    if (e.pointerType === "touch") {
      pinchRef.current.delete(e.pointerId);
      if (pinchRef.current.size < 2) pinchDistRef.current = 0;
    }
    const rd = rulerDragRef.current;
    if (rd) {
      rulerDragRef.current = null;
      if (rd.kind === "region" && !rd.moved) {
        const reg = loopRegionRef.current;
        if (reg && (rd.anchor < reg.a || rd.anchor > reg.b)) applyLoopRegion(null);
        seekTo(rd.anchor);
      }
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      dragRef.current = null;
      if (drag.changed) {
        if (drag.kind === "resize") lastLenRef.current = drag.note.d;
        afterEdit();
      }
      return;
    }
    const p = pointer.current;
    pointer.current = null;
    if (!p || p.panned) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left - KEYS_W;
    if (localX < 0) return;
    seekTo(scrollRef.current + localX / pxPerTickRef.current);
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    if (e.ctrlKey || e.metaKey) {
      const rect = canvas.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - rect.left - KEYS_W);
    } else {
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal) {
        const h = canvas.height / (window.devicePixelRatio || 1);
        const plotH = h - RULER_H - VEL_H - SCROLL_H;
        const contentH = (d.hiPitch - d.loPitch + 1) * rowHRef.current;
        if (contentH > plotH + 1) {
          scrollV(e.deltaY);
          return;
        }
      }
      const delta = horizontal && Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const plotW = Math.max(1, canvas.width / (window.devicePixelRatio || 1) - KEYS_W - SCROLL_W);
      followRef.current = false;
      scrollRef.current = clampScroll(
        scrollRef.current + delta / pxPerTickRef.current,
        d,
        plotW / pxPerTickRef.current
      );
      dirtyRef.current = true;
    }
  };

  /* ---------- render ---------- */
  if (status === "error") {
    // Rendered nothing at all before, so a failed fetch was
    // indistinguishable from a tool that simply has no editor. On the
    // paid tier that reads as a missing feature rather than a hiccup.
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] text-white/45">
        The editor could not load this file. The download above still works.
      </div>
    );
  }

  const bpmNow = data ? Math.round(data.baseBpm * (tempoPct / 100)) : 0;

  const noteOps = (
    <NoteOps
      snapLabel={snapDiv ? `1/${snapDiv}` : "off"}
      onQuantize={() => {
        quantizeAll();
        closePanels();
      }}
      onTranspose={(n) => {
        transposeAll(n);
        closePanels();
      }}
      onVelocity={(m) => {
        velocityTool(m);
        closePanels();
      }}
    />
  );

  return (
    <div className="relative rounded-xl border border-white/10 bg-white/[0.02] p-2">
      {/* ---------- toolbar ---------- */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.07] bg-black/20 px-2 py-1.5">
        <span className="flex items-center gap-1.5 pr-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
          <Sparkles className="h-3.5 w-3.5 text-amber-500/80" aria-hidden />
          Forge Roll
        </span>

        {status === "ready" && (
          <>
            <Group>
              <GBtn
                label="Select"
                title="Select mode — drag to pan, click to seek"
                active={!editMode}
                onClick={() => setMode(false)}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                <span className="ml-1.5 hidden sm:inline">Select</span>
              </GBtn>
              <GBtn
                label="Draw"
                title="Draw mode — drag notes to move, edges to resize, double-click to add"
                active={editMode}
                onClick={() => setMode(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="ml-1.5 hidden sm:inline">Draw</span>
              </GBtn>
            </Group>

            <Picker
              ariaLabel="Snap grid"
              title="Snap grid — where dragged notes land, and what Quantize aligns to"
              value={String(snapDiv)}
              mono
              icon={
                <Magnet
                  className={cn("h-3.5 w-3.5", snapDiv ? "text-amber-400/80" : "text-white/30")}
                  aria-hidden
                />
              }
              options={[
                { value: "0", label: "Off" },
                { value: "4", label: "1/4" },
                { value: "8", label: "1/8" },
                { value: "16", label: "1/16" },
                { value: "32", label: "1/32" },
              ]}
              onChange={(v) => setSnapDiv(Number(v) as 0 | 4 | 8 | 16 | 32)}
            />

            <Group>
              <GBtn
                label="Scale highlight"
                title="Tint in-key rows and flag out-of-key notes in red"
                active={scaleHighlight}
                onClick={toggleScale}
              >
                Key
              </GBtn>
            </Group>
            <Picker
              ariaLabel="Key and scale"
              title="Key guessed from the transcribed notes — pick any key to override"
              value={keyOverride}
              mono
              options={[
                {
                  value: "auto",
                  label: detectedKey ? `Auto · ${detectedKey.label}` : "Auto",
                },
                ...ALL_KEYS.map((k) => ({ value: `${k.tonic}:${k.mode}`, label: k.label })),
              ]}
              onChange={selectKey}
            />

            <div className="ml-auto flex items-center gap-1.5">
              <Group>
                <GBtn
                  label="Note tools"
                  title="Quantize, transpose, velocity"
                  active={panel === "notes"}
                  onClick={() => openPanel("notes")}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </GBtn>
              </Group>

              <Group>
                <GBtn label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={historyLen === 0}>
                  <Undo2 className="h-3.5 w-3.5" />
                </GBtn>
                <GBtn label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={redoLen === 0}>
                  <Redo2 className="h-3.5 w-3.5" />
                </GBtn>
              </Group>

              <Group>
                <GBtn label="Zoom out" title="Zoom out (Ctrl+scroll)" onClick={() => zoomBy(1 / 1.35)}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </GBtn>
                <GBtn label="Zoom in" title="Zoom in (Ctrl+scroll)" onClick={() => zoomBy(1.35)}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </GBtn>
                <GBtn label="Fit" title="Fit the whole file in view" onClick={fitAll}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </GBtn>
              </Group>

              <Group>
                <GBtn
                  label="Shortcuts"
                  title="Keyboard and mouse shortcuts"
                  active={panel === "help"}
                  onClick={() => openPanel("help")}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </GBtn>
              </Group>

              <button
                type="button"
                onClick={exportEdited}
                disabled={historyLen === 0}
                title={historyLen === 0 ? "Make an edit first" : "Download the MIDI with your edits applied"}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                  historyLen === 0
                    ? "pointer-events-none border-white/[0.07] text-white/25"
                    : "border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                )}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Save edits</span>
                {historyLen > 0 && (
                  <span className="rounded bg-black/30 px-1 font-mono text-[10px]">{historyLen}</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {status === "loading" && (
        <div className="flex h-[190px] items-center justify-center text-sm text-white/40">
          Preparing preview…
        </div>
      )}

      {status === "ready" && data && (
        <>
          {/* ---------- canvas ---------- */}
          <div ref={wrapRef} className="relative mt-2 w-full">
            <canvas
              ref={canvasRef}
              className={cn(
                "w-full touch-none rounded-lg border border-white/10 bg-black/30",
                editMode ? "cursor-crosshair border-amber-500/25" : "cursor-grab active:cursor-grabbing"
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onContextMenu={onCanvasContextMenu}
              onPointerLeave={() => {
                hoverNoteRef.current = null;
                setHover(null);
              }}
              onWheel={onWheel}
            />
            {hover && !ctxMenu && (
              <div
                className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 font-mono text-[10px] text-white/85 shadow-lg"
                style={{ left: Math.min(hover.x + 12, (wrapRef.current?.clientWidth ?? 600) - 220), top: Math.max(0, hover.y - 30) }}
              >
                {hover.text}
              </div>
            )}
            {ctxMenu && (
              <div
                className="absolute z-30 w-52 overflow-hidden rounded-lg border border-white/12 bg-graphite-900/98 shadow-2xl shadow-black/60 backdrop-blur"
                style={{
                  left: Math.min(ctxMenu.x, (wrapRef.current?.clientWidth ?? 600) - 220),
                  top: Math.min(ctxMenu.y, Math.max(0, (canvasRef.current?.clientHeight ?? 400) - 240)),
                }}
              >
                {noteOps}
              </div>
            )}
          </div>

          {/* ---------- transport ---------- */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.07] bg-black/20 px-2 py-1.5">
            <Group>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                className="flex h-7 w-10 shrink-0 items-center justify-center bg-amber-500 text-black transition hover:bg-amber-400"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-px h-3.5 w-3.5" />}
              </button>
              <GBtn label="Stop" title="Stop and return to the start" onClick={stop}>
                <Square className="h-3.5 w-3.5" />
              </GBtn>
              <GBtn
                label="Loop"
                title={loopRegion ? "Loop region — drag the ruler to change" : "Loop — drag on the ruler to loop a section"}
                active={loop}
                onClick={toggleLoop}
              >
                <Repeat className="h-3.5 w-3.5" />
              </GBtn>
              <GBtn label="Metronome" title="Metronome click" active={metronome} onClick={toggleMetronome}>
                <Headphones className="h-3.5 w-3.5" />
              </GBtn>
            </Group>

            <span
              ref={timeRef}
              className="shrink-0 font-mono text-[11px] tabular-nums text-white/45"
            >
              0:00 / 0:00
            </span>

            <input
              ref={seekRef}
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              aria-label="Seek"
              className="af-range mx-1 min-w-[80px] flex-1"
              onPointerDown={() => (seekingRef.current = true)}
              onPointerUp={() => (seekingRef.current = false)}
              onChange={(e) => {
                const v = Number(e.target.value);
                e.currentTarget.style.setProperty("--p", `${v / 10}%`);
                seekTo((v / 1000) * data.durationTicks);
              }}
            />

            <Group>
              <GBtn label="Slower" title="Slow down 5%" onClick={() => setTempo(tempoPct - 5)} disabled={tempoPct <= 50}>
                <Minus className="h-3 w-3" />
              </GBtn>
              <button
                type="button"
                onClick={() => setTempo(100)}
                title={`${tempoPct}% of original tempo — click to reset`}
                className="h-7 w-[66px] shrink-0 text-center font-mono text-[11px] tabular-nums text-white/65 transition-colors hover:text-white/90"
              >
                {bpmNow} BPM
              </button>
              <GBtn label="Faster" title="Speed up 5%" onClick={() => setTempo(tempoPct + 5)} disabled={tempoPct >= 150}>
                <Plus className="h-3 w-3" />
              </GBtn>
            </Group>

            <Picker
              ariaLabel="Playback sound"
              title="Playback sound"
              value={instrument}
              up
              options={INSTRUMENTS.map((inst) => ({ value: inst.key, label: inst.label }))}
              onChange={(v) => changeInstrument(v as InstrumentKind)}
              trailing={
                instrumentLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-white/40" aria-hidden />
                ) : null
              }
            />

            {sourceFile && (
              <Group>
                <GBtn
                  label="Compare with original"
                  title="Crossfade between the MIDI and your original audio"
                  active={compare}
                  onClick={() => openPanel("compare")}
                >
                  <AudioLines className="h-3.5 w-3.5" />
                </GBtn>
              </Group>
            )}
          </div>

          {data.tracks.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.tracks.map((track, ti) => {
                const dim = soloed.size > 0 ? !soloed.has(ti) : muted.has(ti);
                return (
                  <div
                    key={ti}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-black/20 py-0.5 pl-2 pr-0.5 text-[11px]",
                      dim && "opacity-40"
                    )}
                  >
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: track.color }} />
                    <span className="max-w-[110px] truncate text-white/65">{track.name}</span>
                    <span className="font-mono text-[10px] text-white/30">{track.notes.length}</span>
                    <button
                      type="button"
                      aria-label={`Mute ${track.name}`}
                      title={`Mute ${track.name}`}
                      onClick={() => toggleMute(ti)}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/10",
                        muted.has(ti) ? "text-rose-400" : "text-white/40"
                      )}
                    >
                      <VolumeX className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Solo ${track.name}`}
                      title={`Solo ${track.name}`}
                      onClick={() => toggleSolo(ti)}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/10",
                        soloed.has(ti) ? "text-amber-400" : "text-white/40"
                      )}
                    >
                      <Headphones className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {panel === "notes" && (
            <Panel className="right-2 top-12 w-52" onClose={closePanels}>
              {noteOps}
            </Panel>
          )}

          {panel === "help" && (
            <Panel className="right-2 top-12 w-[268px]" onClose={closePanels}>
              <div className="px-3 py-2.5">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                  Shortcuts
                </p>
                <ul className="space-y-1.5 text-[11px] text-white/55">
                  <li className="flex justify-between gap-3"><span>Play / pause</span><Kbd>Space</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Move note</span><Kbd>drag</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Resize note</span><Kbd>drag edge</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Add note (Draw)</span><Kbd>click</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Draw to length</span><Kbd>click-drag</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Delete note</span><Kbd>right-click</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Erase several</span><Kbd>right-drag</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Note tools</span><Kbd>right-click empty</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Clear loop</span><Kbd>right-click ruler</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Zoom</span><Kbd>Ctrl+scroll</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Pan</span><Kbd>Shift+scroll</Kbd></li>
                  <li className="flex justify-between gap-3"><span>Undo</span><Kbd>Ctrl+Z</Kbd></li>
                </ul>
              </div>
            </Panel>
          )}

          {panel === "compare" && (
            <Panel className="bottom-2 right-2 w-[300px]" onClose={closePanels}>
              <div className="px-3 py-2.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                    Compare
                  </span>
                  {!originalReady && <Loader2 className="h-3 w-3 animate-spin text-white/35" aria-hidden />}
                </div>
                <Group className="w-full">
                  {[
                    { v: 0, l: "Original" },
                    { v: 0.5, l: "Both" },
                    { v: 1, l: "MIDI" },
                  ].map((o) => (
                    <GBtn
                      key={o.l}
                      label={o.l}
                      title={o.v === 0 ? "Hear only your original audio" : o.v === 1 ? "Hear only the transcribed MIDI" : "Hear both at equal level"}
                      active={compare && Math.abs(mix - o.v) < 0.02}
                      onClick={() => applyMix(o.v, true)}
                      className="flex-1 justify-center"
                    >
                      {o.l}
                    </GBtn>
                  ))}
                </Group>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(mix * 100)}
                  aria-label="Crossfade between original audio and MIDI"
                  className="af-range mt-3 w-full"
                  style={{ "--p": `${Math.round(mix * 100)}%` } as React.CSSProperties}
                  onChange={(e) => applyMix(Number(e.target.value) / 100, true)}
                />
                <button
                  type="button"
                  onClick={() => {
                    applyMix(mix, false);
                    closePanels();
                  }}
                  className="mt-2.5 w-full rounded-md border border-white/10 py-1 text-[11px] text-white/50 transition-colors hover:text-white/80"
                >
                  Turn compare off
                </button>
              </div>
            </Panel>
          )}
        </>
      )}

      <style>{`
        .af-scroll::-webkit-scrollbar { width: 8px; }
        .af-scroll::-webkit-scrollbar-track { background: transparent; }
        .af-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.16);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .af-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
        .af-range {
          -webkit-appearance: none;
          appearance: none;
          height: 3px;
          border-radius: 2px;
          outline: none;
          background: linear-gradient(
            to right,
            rgba(245, 158, 11, 0.55) 0,
            rgba(245, 158, 11, 0.55) var(--p, 0%),
            rgba(255, 255, 255, 0.1) var(--p, 0%),
            rgba(255, 255, 255, 0.1) 100%
          );
        }
        .af-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 12px;
          width: 6px;
          border-radius: 2px;
          background: #9a9aa4;
          border: none;
          cursor: pointer;
          transition: background 120ms ease;
        }
        .af-range:hover::-webkit-slider-thumb { background: #d4d4dc; }
        .af-range::-moz-range-thumb {
          height: 12px;
          width: 6px;
          border-radius: 2px;
          background: #9a9aa4;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function Group({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center overflow-hidden rounded-md border border-white/[0.09] bg-black/25 divide-x divide-white/[0.07]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Picker({
  ariaLabel,
  title,
  value,
  options,
  onChange,
  icon,
  trailing,
  mono,
  up,
}: {
  ariaLabel: string;
  title?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  mono?: boolean;
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={title ?? ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md border border-white/[0.09] bg-black/25 pl-2 pr-1.5 text-[11px] transition-colors",
          open ? "text-white/90" : "text-white/60 hover:text-white/85"
        )}
      >
        {icon}
        <span className={cn("whitespace-nowrap", mono && "font-mono")}>
          {current?.label ?? value}
        </span>
        {trailing}
        <ChevronDown className={cn("h-3 w-3 text-white/35 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onPointerDown={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            className={cn(
              "af-scroll absolute left-0 z-30 max-h-64 min-w-full overflow-y-auto rounded-lg border border-white/12 bg-graphite-900/98 py-1 shadow-2xl shadow-black/60 backdrop-blur",
              up ? "bottom-full mb-1" : "top-full mt-1"
            )}
          >
            {options.map((o) => {
              const on = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 whitespace-nowrap px-3 py-1.5 text-left text-[11px] transition-colors",
                    mono && "font-mono",
                    on ? "text-amber-400" : "text-white/65 hover:bg-white/[0.07] hover:text-white/90"
                  )}
                >
                  {o.label}
                  {on && <Check className="h-3 w-3 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function GBtn({
  label,
  title,
  active,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 min-w-[28px] items-center justify-center px-2 text-[11px] transition-colors disabled:pointer-events-none disabled:opacity-30",
        active ? "bg-amber-500/15 text-amber-400" : "text-white/55 hover:bg-white/[0.06] hover:text-white/85",
        className
      )}
    >
      {children}
    </button>
  );
}

function Panel({
  className,
  onClose,
  children,
}: {
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-20" onPointerDown={onClose} aria-hidden />
      <div
        className={cn(
          "absolute z-30 overflow-hidden rounded-lg border border-white/12 bg-graphite-900/98 shadow-2xl shadow-black/60 backdrop-blur",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

function NoteOps({
  snapLabel,
  onQuantize,
  onTranspose,
  onVelocity,
}: {
  snapLabel: string;
  onQuantize: () => void;
  onTranspose: (semis: number) => void;
  onVelocity: (mode: "flatten" | "humanize") => void;
}) {
  return (
    <div className="py-1 text-[11px]">
      <MenuRow onClick={onQuantize} hint={snapLabel}>
        Quantize to grid
      </MenuRow>
      <MenuSep />
      <MenuRow onClick={() => onTranspose(1)} hint="+1">Transpose up</MenuRow>
      <MenuRow onClick={() => onTranspose(-1)} hint="−1">Transpose down</MenuRow>
      <MenuRow onClick={() => onTranspose(12)} hint="+12">Octave up</MenuRow>
      <MenuRow onClick={() => onTranspose(-12)} hint="−12">Octave down</MenuRow>
      <MenuSep />
      <MenuRow onClick={() => onVelocity("flatten")}>Flatten velocity</MenuRow>
      <MenuRow onClick={() => onVelocity("humanize")}>Humanize velocity</MenuRow>
    </div>
  );
}

function MenuRow({
  onClick,
  hint,
  children,
}: {
  onClick: () => void;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white/90"
    >
      <span>{children}</span>
      {hint && <span className="font-mono text-[10px] text-white/30">{hint}</span>}
    </button>
  );
}

function MenuSep() {
  return <div className="my-1 h-px bg-white/[0.07]" />;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="shrink-0 rounded border border-white/12 bg-white/[0.05] px-1 py-px font-mono text-[10px] text-white/50">
      {children}
    </kbd>
  );
}

function lowerBound(notes: PlayerNote[], target: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].t < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function clampScroll(value: number, d: ParsedMidi, viewTicks: number): number {
  return Math.max(0, Math.min(d.durationTicks - viewTicks, value));
}

const RAMP_CACHE = new Map<string, string[]>();

/* Velocity ramp: quiet notes darker, loud notes full colour. */
function rampFor(hex: string): string[] {
  const hit = RAMP_CACHE.get(hex);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const out: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const f = 0.5 + (i / 8) * 0.5;
    out.push(`rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`);
  }
  RAMP_CACHE.set(hex, out);
  return out;
}