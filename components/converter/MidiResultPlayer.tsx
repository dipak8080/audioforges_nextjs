"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import {
  AudioLines,
  Download,
  Headphones,
  Loader2,
  Magnet,
  Pause,
  Pencil,
  Play,
  Redo2,
  Repeat,
  Sparkles,
  Square,
  Undo2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

type ToneInstr = {
  triggerAttackRelease: (
    note: number,
    duration: number,
    time: number,
    velocity: number
  ) => unknown;
  releaseAll: () => unknown;
  dispose: () => unknown;
  connect: (node: InstanceType<ToneModule["Channel"]>) => unknown;
};

/* Guards every trigger behind sample readiness so a sampler never throws
 * "buffer is either not set or not loaded" while its samples stream in. */
type Instrument = {
  ready: boolean;
  triggerAttackRelease: ToneInstr["triggerAttackRelease"];
  releaseAll: () => void;
  dispose: () => void;
  connect: ToneInstr["connect"];
};

function guard(inner: ToneInstr): Instrument {
  const inst: Instrument = {
    ready: false,
    triggerAttackRelease: (n, d, t, v) => {
      if (!inst.ready) return;
      try {
        inner.triggerAttackRelease(n, d, t, v);
      } catch {}
    },
    releaseAll: () => {
      try {
        inner.releaseAll();
      } catch {}
    },
    dispose: () => {
      try {
        inner.dispose();
      } catch {}
    },
    connect: (node) => inner.connect(node),
  };
  return inst;
}

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

export type InstrumentKind = "piano" | "epiano" | "pluck" | "saw" | "bass";

const INSTRUMENTS: { key: InstrumentKind; label: string }[] = [
  { key: "piano", label: "Piano" },
  { key: "epiano", label: "E-Piano" },
  { key: "pluck", label: "Pluck" },
  { key: "saw", label: "Saw" },
  { key: "bass", label: "Bass" },
];

const PIANO_BASE = "https://tonejs.github.io/audio/salamander/";
const PIANO_URLS: Record<string, string> = {
  A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
  C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
  C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3",
  C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
  C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
  C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
  C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3", C8: "C8.mp3",
};

function makeInstrument(
  Tone: ToneModule,
  kind: InstrumentKind,
  percussion: boolean,
  onLoad: () => void
): Instrument {
  if (percussion) {
    const s = new Tone.PolySynth(Tone.MembraneSynth, {
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    });
    s.maxPolyphony = 32;
    const inst = guard(s as unknown as ToneInstr);
    inst.ready = true;
    queueMicrotask(onLoad);
    return inst;
  }
  if (kind === "piano") {
    let inst: Instrument | null = null;
    const sampler = new Tone.Sampler({
      urls: PIANO_URLS,
      baseUrl: PIANO_BASE,
      release: 1.2,
      onload: () => {
        if (inst) inst.ready = true;
        onLoad();
      },
      onerror: () => {
        onLoad();
      },
    });
    inst = guard(sampler as unknown as ToneInstr);
    if (sampler.loaded) inst.ready = true;
    return inst;
  }
  let s: InstanceType<ToneModule["PolySynth"]>;
  if (kind === "epiano") {
    s = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 14,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.6, sustain: 0.15, release: 0.8 },
      modulation: { type: "triangle" },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0.05, release: 0.4 },
    });
  } else if (kind === "pluck") {
    s = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.002, decay: 0.25, sustain: 0.05, release: 0.3 },
    });
  } else if (kind === "bass") {
    s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", spread: 12, count: 2 },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.2 },
    });
  } else {
    s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", spread: 20, count: 3 },
      envelope: { attack: 0.004, decay: 0.15, sustain: 0.5, release: 0.25 },
    });
  }
  s.maxPolyphony = 48;
  const inst = guard(s as unknown as ToneInstr);
  inst.ready = true;
  queueMicrotask(onLoad);
  return inst;
}

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
const KEYS_W = 60;
const RULER_H = 22;
const VEL_H = 48;
const ROW_MIN = 14;
const ROW_MAX = 18;
const CANVAS_MAX_H = 460;
const BLACK_PC = new Set([1, 3, 6, 8, 10]);
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FOLLOW_TO = 0.28;

/* Equal-power crossfade; when compare is off the original is fully silent. */
function mixGains(mix: number, compare: boolean) {
  if (!compare) return { midi: 1, orig: 0 };
  const a = mix * (Math.PI / 2);
  return { midi: Math.sin(a), orig: Math.cos(a) };
}

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
    const plotW = Math.max(1, w - KEYS_W);
    const plotH = Math.max(1, h - RULER_H - VEL_H);
    const view1 = view0 + plotW / ppt;
    if (!Number.isFinite(view0) || !Number.isFinite(view1)) return;
    const rowH = rowHRef.current;
    const vs = vScrollRef.current;
    const yFor = (p: number) => RULER_H + (d.hiPitch - p) * rowH - vs;
    const xFor = (t: number) => KEYS_W + (t - view0) * ppt;
    const isBlack = (p: number) => BLACK_PC.has(p % 12);
    const pTop = Math.min(d.hiPitch, d.hiPitch - Math.floor(vs / rowH));
    const pBot = Math.max(d.loPitch, d.hiPitch - Math.ceil((vs + plotH) / rowH));

    /* plot background + row striping */
    ctx.fillStyle = "#151518";
    ctx.fillRect(KEYS_W, RULER_H, plotW, plotH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYS_W, RULER_H, plotW, plotH);
    ctx.clip();

    const key = keyRef.current;
    const showScale = scaleRef.current && !!key;
    for (let p = pBot; p <= pTop; p++) {
      const y = yFor(p);
      if (isBlack(p)) {
        ctx.fillStyle = "#141417";
        ctx.fillRect(KEYS_W, y, plotW, rowH);
      } else {
        ctx.fillStyle = "#1c1c20";
        ctx.fillRect(KEYS_W, y, plotW, rowH);
      }
      if (showScale) {
        const inKey = key.pcs.has(p % 12);
        ctx.fillStyle = inKey ? "rgba(251,191,36,0.05)" : "rgba(0,0,0,0.3)";
        ctx.fillRect(KEYS_W, y, plotW, rowH);
        if (p % 12 === key.tonic) {
          ctx.fillStyle = "rgba(251,191,36,0.09)";
          ctx.fillRect(KEYS_W, y, plotW, rowH);
        }
      }
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(KEYS_W, y + rowH - 1, plotW, 1);
      if (p % 12 === 11) {
        ctx.fillStyle = "rgba(255,255,255,0.09)";
        ctx.fillRect(KEYS_W, y + rowH - 1, plotW, 1);
      }
    }
    ctx.restore();

    /* ruler strip */
    const rulerGrad = ctx.createLinearGradient(0, 0, 0, RULER_H);
    rulerGrad.addColorStop(0, "#232328");
    rulerGrad.addColorStop(1, "#18181c");
    ctx.fillStyle = rulerGrad;
    ctx.fillRect(0, 0, w, RULER_H);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, RULER_H - 1, w, 1);

    const beat = Math.max(1, d.ppq);
    const bar = beat * Math.max(1, d.beatsPerBar);
    const sixteenth = Math.max(1, Math.round(beat / 4));
    const beatPx = beat * ppt;
    const barPx = bar * ppt;
    const step = sixteenth * ppt >= 9 ? sixteenth : beatPx > 11 ? beat : bar;
    const labelEvery = barPx > 44 ? bar : bar * Math.ceil(48 / Math.max(1, barPx));
    ctx.font = "600 10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    if (step * ppt >= 2) {
      let guard = Math.ceil(plotW / (step * ppt)) + 2;
      for (let t = Math.floor(view0 / step) * step; t <= view1 && guard > 0; t += step, guard--) {
        if (t < 0) continue;
        const x = xFor(t);
        const isBar = t % bar === 0;
        const isBeat = t % beat === 0;
        ctx.fillStyle = isBar
          ? "rgba(255,255,255,0.22)"
          : isBeat
            ? "rgba(0,0,0,0.55)"
            : "rgba(0,0,0,0.28)";
        ctx.fillRect(x, RULER_H, isBar ? 1.5 : 1, plotH);
        if (isBeat) {
          ctx.fillStyle = isBar ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)";
          ctx.fillRect(x, RULER_H - (isBar ? 9 : 5), 1, isBar ? 9 : 5);
        }
        if (isBar && t % labelEvery === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.fillText(String(Math.round(t / bar) + 1), x + 5, RULER_H / 2 - 1);
        }
      }
    }

    /* loop region */
    const region = loopRegionRef.current;
    if (region) {
      const ax = xFor(region.a);
      const bx = xFor(region.b);
      ctx.fillStyle = "rgba(45,212,191,0.07)";
      ctx.fillRect(ax, RULER_H, bx - ax, plotH);
      ctx.fillStyle = "rgba(45,212,191,0.28)";
      ctx.fillRect(ax, 0, bx - ax, RULER_H - 1);
      ctx.fillStyle = "rgba(45,212,191,0.9)";
      ctx.fillRect(ax, 0, 1.5, RULER_H + plotH);
      ctx.fillRect(bx - 1.5, 0, 1.5, RULER_H + plotH);
    }

    /* notes */
    const now = posRef.current;
    const solo = soloedRef.current;
    const mute = mutedRef.current;
    const noteH = Math.max(2.5, rowH - 3);
    const totalNotes = d.tracks.reduce((s, t) => s + t.notes.length, 0);
    const stride = Math.max(1, Math.ceil(totalNotes / 25000));
    const fancy = totalNotes <= 6000;
    const activePitches = new Set<number>();
    const velNotes: { x: number; v: number; color: string; active: boolean }[] = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYS_W, RULER_H, plotW, plotH);
    ctx.clip();

    d.tracks.forEach((track, ti) => {
      const audible = solo.size > 0 ? solo.has(ti) : !mute.has(ti);

      let i = lowerBound(track.notes, view0 - track.maxDur);
      for (; i < track.notes.length; i += stride) {
        const n = track.notes[i];
        if (n.t > view1) break;
        if (n.t + n.d < view0) continue;
        const x = xFor(n.t);
        const nw = Math.max(2, n.d * ppt - 0.75);
        const y = yFor(n.p) + (rowH - noteH) / 2;
        const active = audible && playingRef.current && now >= n.t && now < n.t + n.d;
        if (active) activePitches.add(n.p);
        const r = Math.min(1.5, noteH / 3);
        ctx.globalAlpha = audible ? (active ? 1 : 0.62 + n.v * 0.32) : 0.14;
        if (fancy && noteH >= 5) {
          const grad = ctx.createLinearGradient(0, y, 0, y + noteH);
          grad.addColorStop(0, active ? track.bright : lighten(track.color));
          grad.addColorStop(1, active ? track.color : track.color);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = active ? track.bright : track.color;
        }
        if (active && fancy) {
          ctx.shadowColor = track.bright;
          ctx.shadowBlur = 5;
        }
        roundRect(ctx, x, y, nw, noteH, r);
        ctx.shadowBlur = 0;
        if (fancy && nw >= 4 && noteH >= 6 && audible) {
          ctx.globalAlpha = active ? 0.95 : 0.7;
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fillRect(x + 1, y + 1, Math.max(1, nw - 2), 1);
          ctx.fillRect(x + 1, y + 1, 1, noteH - 2);
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(x + 1, y + noteH - 2, Math.max(1, nw - 2), 1);
          ctx.fillRect(x + nw - 2, y + 1, 1, noteH - 2);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "rgba(0,0,0,0.75)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x + 0.5, y + 0.5, nw - 1, noteH - 1, r);
          ctx.stroke();
        }
        if (showScale && !track.percussion && !key.pcs.has(n.p % 12) && audible) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(251,113,133,0.95)";
          ctx.fillRect(x + 1, y + 1, Math.min(3, nw - 2), noteH - 2);
        }
        if (fancy && audible && noteH >= 9) {
          const label = NAMES[n.p % 12] + (Math.floor(n.p / 12) - 1);
          if (nw >= label.length * 6.5 + 8) {
            ctx.globalAlpha = active ? 1 : 0.85;
            ctx.fillStyle = "rgba(20,12,0,0.9)";
            ctx.font = "700 9px ui-monospace, monospace";
            ctx.fillText(label, x + 4, y + noteH / 2 + 0.5);
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

    /* playhead comet */
    const px = xFor(now);
    if (px >= KEYS_W - 1 && px <= w + 1) {
      const trail = Math.min(18, px - KEYS_W);
      if (playingRef.current && trail > 2) {
        const grad = ctx.createLinearGradient(px - trail, 0, px, 0);
        grad.addColorStop(0, "rgba(251,191,36,0)");
        grad.addColorStop(1, "rgba(251,191,36,0.07)");
        ctx.fillStyle = grad;
        ctx.fillRect(px - trail, RULER_H, trail, plotH);
      }
      ctx.fillStyle = "rgba(251,191,36,0.95)";
      ctx.fillRect(px, RULER_H, 1, plotH);
    }
    ctx.restore();

    /* velocity lane */
    const velTop = RULER_H + plotH;
    ctx.fillStyle = "#0d0d10";
    ctx.fillRect(0, velTop, w, VEL_H);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(0, velTop, w, 1);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "600 8.5px ui-monospace, monospace";
    ctx.fillText("VELOCITY", 6, velTop + 10);
    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYS_W, velTop + 1, plotW, VEL_H - 1);
    ctx.clip();
    const velStride = Math.max(1, Math.ceil(velNotes.length / 3000));
    for (let vi = 0; vi < velNotes.length; vi += velStride) {
      const vn = velNotes[vi];
      const stem = 5 + vn.v * (VEL_H - 13);
      ctx.globalAlpha = vn.active ? 1 : 0.7;
      ctx.fillStyle = vn.color;
      ctx.fillRect(vn.x, velTop + VEL_H - stem, 1, stem);
      ctx.beginPath();
      ctx.arc(vn.x + 0.5, velTop + VEL_H - stem, vn.active ? 3 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (px >= KEYS_W - 1 && px <= w + 1) {
      ctx.fillStyle = "rgba(251,191,36,0.4)";
      ctx.fillRect(px, velTop + 1, 1, VEL_H - 1);
    }
    ctx.restore();

    if (px >= KEYS_W - 8 && px <= w + 8) {
      ctx.fillStyle = "rgba(251,191,36,0.98)";
      ctx.beginPath();
      ctx.roundRect(px - 6, 1, 13, RULER_H - 9, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - 6, RULER_H - 8);
      ctx.lineTo(px + 7, RULER_H - 8);
      ctx.lineTo(px + 0.5, RULER_H - 0.5);
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
    const whiteW = KEYS_W - 3;
    const whiteGrad = ctx.createLinearGradient(0, 0, whiteW, 0);
    whiteGrad.addColorStop(0, "#c6c6cc");
    whiteGrad.addColorStop(0.18, "#dedee2");
    whiteGrad.addColorStop(1, "#f4f4f6");
    const whiteLit = ctx.createLinearGradient(0, 0, whiteW, 0);
    whiteLit.addColorStop(0, "#d97706");
    whiteLit.addColorStop(0.3, "#f59e0b");
    whiteLit.addColorStop(1, "#fde68a");

    for (let p = pBot - 1; p <= pTop + 1; p++) {
      if (!inRange(p) || isBlack(p)) continue;
      const lit = activePitches.has(p);
      const top = yFor(p) - (inRange(p + 1) && isBlack(p + 1) ? rowH / 2 : 0);
      const bottom = yFor(p) + rowH + (inRange(p - 1) && isBlack(p - 1) ? rowH / 2 : 0);
      const kh = bottom - top - 1;
      ctx.fillStyle = lit ? whiteLit : whiteGrad;
      ctx.beginPath();
      ctx.roundRect(0, top, whiteW, kh, [0, 3, 3, 0]);
      ctx.fill();
      ctx.fillStyle = lit ? "rgba(120,60,0,0.5)" : "rgba(70,70,80,0.55)";
      ctx.fillRect(0, bottom - 1.5, whiteW, 1);
      const isC = p % 12 === 0;
      ctx.fillStyle = lit ? "rgba(50,25,0,0.9)" : isC ? "#26262c" : "rgba(70,70,80,0.75)";
      ctx.font = `${isC ? 700 : 500} ${isC ? 10 : 9}px ui-monospace, monospace`;
      ctx.textAlign = "right";
      ctx.fillText(NAMES[p % 12] + (Math.floor(p / 12) - 1), whiteW - 5, (top + bottom) / 2 + 0.5);
      ctx.textAlign = "left";
    }
    const bw = Math.round(KEYS_W * 0.56);
    for (let p = pBot - 1; p <= pTop + 1; p++) {
      if (!inRange(p) || !isBlack(p)) continue;
      const lit = activePitches.has(p);
      const y = yFor(p) + 0.5;
      const bh = rowH - 1;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(0, y + 1, bw + 2, bh + 1, [0, 3, 3, 0]);
      ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      if (lit) {
        g.addColorStop(0, "#fbbf24");
        g.addColorStop(1, "#b45309");
      } else {
        g.addColorStop(0, "#4a4a52");
        g.addColorStop(0.55, "#26262c");
        g.addColorStop(1, "#111114");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(0, y, bw, bh, [0, 3, 3, 0]);
      ctx.fill();
      ctx.fillStyle = lit ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)";
      ctx.fillRect(0, y, bw - 2, 1);
      ctx.fillStyle = lit ? "rgba(255,230,150,0.45)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(0, y + bh - 2, bw - 3, 1);
    }
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(KEYS_W - 2, RULER_H, 2, plotH);
    const keyShadow = ctx.createLinearGradient(KEYS_W, 0, KEYS_W + 12, 0);
    keyShadow.addColorStop(0, "rgba(0,0,0,0.4)");
    keyShadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = keyShadow;
    ctx.fillRect(KEYS_W, RULER_H, 12, plotH);
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
          const viewTicks = Math.max(1, w - KEYS_W) / pxPerTickRef.current;
          if (posRef.current > scrollRef.current + viewTicks * FOLLOW_AT) {
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
      seekRef.current.value = String(
        Math.round((posRef.current / d.durationTicks) * 1000)
      );
    }
  };

  useEffect(() => {
    if (status === "ready") syncTimeUi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const maxPlot = CANVAS_MAX_H - RULER_H - VEL_H;
      const rowH = Math.max(ROW_MIN, Math.min(ROW_MAX, maxPlot / rows));
      rowHRef.current = rowH;
      const contentH = rows * rowH;
      const h = Math.min(CANVAS_MAX_H, Math.max(300, contentH + RULER_H + VEL_H));
      const plotH = h - RULER_H - VEL_H;
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
      minZoomRef.current = Math.max(1, w - KEYS_W) / d.durationTicks;
      if (
        !Number.isFinite(pxPerTickRef.current) ||
        pxPerTickRef.current <= 0 ||
        pxPerTickRef.current < minZoomRef.current
      ) {
        pxPerTickRef.current = minZoomRef.current;
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
    d.tracks.forEach((track, ti) => {
      const inst = makeInstrument(eng.Tone, kind, track.percussion, () => {
        pending -= 1;
        if (pending <= 0) setInstrumentLoading(false);
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

  const setTempo = (pct: number) => {
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

  const toggleCompare = async () => {
    const next = !compareRef.current;
    if (next && !engineRef.current) await ensureEngine();
    applyMix(next ? 0.5 : 1, next);
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
    const plotW = Math.max(1, w - KEYS_W);
    const plotH = Math.max(1, h - RULER_H - VEL_H);
    const rowH = rowHRef.current;
    const ppt = pxPerTickRef.current;
    return {
      d,
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

  const hitNote = (tick: number, pitch: number, ppt: number) => {
    const d = dataRef.current;
    if (!d) return null;
    for (let ti = d.tracks.length - 1; ti >= 0; ti--) {
      const notes = d.tracks[ti].notes;
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        if (n.p !== pitch) continue;
        if (tick >= n.t && tick <= n.t + n.d) {
          const edgePx = (n.t + n.d - tick) * ppt;
          return { note: n, ti, edge: edgePx <= Math.min(8, Math.max(3, n.d * ppt * 0.3)) };
        }
      }
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
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleEdit = () => {
    const next = !editRef.current;
    editRef.current = next;
    setEditMode(next);
    if (!next) selectedRef.current = null;
    dirtyRef.current = true;
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

  const scrollV = (dy: number) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const h = canvas.height / (window.devicePixelRatio || 1);
    const plotH = Math.max(1, h - RULER_H - VEL_H);
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
    const plotW = Math.max(1, canvas.width / (window.devicePixelRatio || 1) - KEYS_W);
    const ax = Math.max(0, anchorX ?? plotW / 2);
    const old = pxPerTickRef.current;
    const anchorTick = scrollRef.current + ax / old;
    const maxZoom = plotW / (d.ppq * d.beatsPerBar);
    const next = Math.min(maxZoom, Math.max(minZoomRef.current, old * factor));
    pxPerTickRef.current = next;
    scrollRef.current = clampScroll(anchorTick - ax / next, d, plotW / next);
    dirtyRef.current = true;
  };

  const pointer = useRef<{ x: number; y: number; startX: number; startY: number; panned: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
          const hit = hitNote(tick, pitch, g.ppt);
          if (hit) {
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
          if (e.detail === 2) {
            pushHistory();
            const len = lastLenRef.current || g.d.ppq;
            const note: PlayerNote = { t: snapTick(tick), d: len, p: pitch, v: 0.8 };
            const ti = g.d.tracks.findIndex((t) => !t.percussion);
            g.d.tracks[Math.max(0, ti)].notes.push(note);
            selectedRef.current = note;
            void auditionPitch(pitch, Math.max(0, ti));
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
      const plotW = Math.max(1, canvas.width / (window.devicePixelRatio || 1) - KEYS_W);
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
    if (e.pointerType === "touch") {
      pinchRef.current.delete(e.pointerId);
      if (pinchRef.current.size < 2) pinchDistRef.current = 0;
    }
    const rd = rulerDragRef.current;
    if (rd) {
      rulerDragRef.current = null;
      if (rd.kind === "region" && !rd.moved) seekTo(rd.anchor);
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
        const plotH = h - RULER_H - VEL_H;
        const contentH = (d.hiPitch - d.loPitch + 1) * rowHRef.current;
        if (contentH > plotH + 1) {
          scrollV(e.deltaY);
          return;
        }
      }
      const delta = horizontal && Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const plotW = Math.max(1, canvas.width / (window.devicePixelRatio || 1) - KEYS_W);
      scrollRef.current = clampScroll(
        scrollRef.current + delta / pxPerTickRef.current,
        d,
        plotW / pxPerTickRef.current
      );
      dirtyRef.current = true;
    }
  };

  /* ---------- render ---------- */
  if (status === "error") return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Forge Roll
        </span>
        {status === "ready" && (
          <div
            className={cn(
              "flex items-center overflow-hidden rounded-full border font-mono text-[11px] transition-colors",
              scaleHighlight ? "border-amber-500/60 bg-amber-500/10" : "border-white/10"
            )}
          >
            <button
              type="button"
              onClick={toggleScale}
              aria-pressed={scaleHighlight}
              title="Scale highlight — tint in-key rows and flag out-of-key notes in red"
              className={cn(
                "flex items-center gap-1.5 py-1 pl-2.5 pr-2 transition-colors",
                scaleHighlight ? "text-amber-400" : "text-white/60 hover:text-white/85"
              )}
            >
              <span className="text-white/40">Scale</span>
            </button>
            <select
              value={keyOverride}
              onChange={(e) => selectKey(e.target.value)}
              aria-label="Key and scale"
              title="Key guessed from the transcribed notes — pick any key to override"
              className={cn(
                "cursor-pointer bg-transparent py-1 pr-2 outline-none",
                scaleHighlight ? "text-amber-400" : "text-white/70"
              )}
            >
              <option value="auto" className="bg-graphite-900">
                {keyOverride === "auto" && detectedKey ? `Auto · ${detectedKey.label}` : "Auto"}
              </option>
              {ALL_KEYS.map((k) => (
                <option key={k.label} value={`${k.tonic}:${k.mode}`} className="bg-graphite-900">
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {status === "ready" && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleEdit}
              aria-pressed={editMode}
              title="Edit notes: drag to move, edge to resize, double-click to add"
              className={cn(
                "mr-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                editMode
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-white/10 text-white/55 hover:border-white/20 hover:text-white/80"
              )}
            >
              <Pencil className="h-3 w-3" aria-hidden />
              Edit
            </button>
            <IconBtn label="Zoom out" onClick={() => zoomBy(1 / 1.35)}>
              <ZoomOut className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Zoom in" onClick={() => zoomBy(1.35)}>
              <ZoomIn className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        )}
      </div>

      {status === "loading" && (
        <div className="flex h-[190px] items-center justify-center text-sm text-white/40">
          Preparing preview…
        </div>
      )}

      {status === "ready" && data && (
        <>
          <div ref={wrapRef} className="relative w-full">
            <canvas
              ref={canvasRef}
              className={cn(
                "w-full touch-none rounded-lg border border-white/10 bg-black/30",
                editMode ? "border-amber-500/30" : "cursor-grab active:cursor-grabbing"
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => {
                hoverNoteRef.current = null;
                setHover(null);
              }}
              onWheel={onWheel}
            />
            {hover && (
              <div
                className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 font-mono text-[10px] text-white/85 shadow-lg"
                style={{ left: Math.min(hover.x + 12, (wrapRef.current?.clientWidth ?? 600) - 220), top: Math.max(0, hover.y - 30) }}
              >
                {hover.text}
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-2.5">
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
            <IconBtn
              label={loopRegion ? "Loop region (drag the ruler to change, click to clear)" : "Loop — drag on the ruler to loop a section"}
              onClick={toggleLoop}
              active={loop}
            >
              <Repeat className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Metronome click" onClick={toggleMetronome} active={metronome}>
              <Headphones className="h-3.5 w-3.5" />
            </IconBtn>

            <input
              ref={seekRef}
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              aria-label="Seek"
              className="af-midi-range min-w-0 flex-1"
              onPointerDown={() => (seekingRef.current = true)}
              onPointerUp={() => (seekingRef.current = false)}
              onChange={(e) =>
                seekTo((Number(e.target.value) / 1000) * data.durationTicks)
              }
            />

            <span
              ref={timeRef}
              className="shrink-0 font-mono text-[11px] tabular-nums text-white/60"
            >
              0:00 / 0:00
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="w-12 shrink-0 text-[11px] text-white/50">
              {tempoPct}%
            </span>
            <input
              type="range"
              min={50}
              max={150}
              step={5}
              value={tempoPct}
              aria-label="Playback speed"
              className="af-midi-range flex-1"
              onChange={(e) => setTempo(Number(e.target.value))}
            />
            <span className="shrink-0 text-[11px] text-white/40">
              {Math.round(data.baseBpm * (tempoPct / 100))} BPM
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Sound
            </span>
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
                onClick={toggleCompare}
                aria-pressed={compare}
                title="Play your original audio alongside the MIDI to check accuracy"
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

          {editMode && (
            <div className="mt-2.5 overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/[0.035]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                <EditGroup label="Grid">
                  <label
                    className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-black/30 pl-2 pr-1.5 text-[11px] text-white/70"
                    title="Snap grid — where dragged notes land, and what Quantize aligns to"
                  >
                    <Magnet className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                    <select
                      value={snapDiv}
                      onChange={(e) => setSnapDiv(Number(e.target.value) as 0 | 4 | 8 | 16 | 32)}
                      aria-label="Snap grid"
                      className="cursor-pointer bg-transparent font-mono text-[11px] text-amber-400 outline-none"
                    >
                      <option value={0} className="bg-graphite-900">Off</option>
                      <option value={4} className="bg-graphite-900">1/4</option>
                      <option value={8} className="bg-graphite-900">1/8</option>
                      <option value={16} className="bg-graphite-900">1/16</option>
                      <option value={32} className="bg-graphite-900">1/32</option>
                    </select>
                  </label>
                  <ToolChip label="Quantize" title="Align every note's start and length to the snap grid" onClick={quantizeAll} />
                </EditGroup>
                <EditGroup label="Pitch">
                  <ToolChip label="−1" title="Transpose everything down a semitone" onClick={() => transposeAll(-1)} />
                  <ToolChip label="+1" title="Transpose everything up a semitone" onClick={() => transposeAll(1)} />
                  <ToolChip label="−12" title="Transpose everything down an octave" onClick={() => transposeAll(-12)} />
                  <ToolChip label="+12" title="Transpose everything up an octave" onClick={() => transposeAll(12)} />
                </EditGroup>
                <EditGroup label="Velocity">
                  <ToolChip label="Flatten" title="Set every note to the same velocity" onClick={() => velocityTool("flatten")} />
                  <ToolChip label="Humanize" title="Add small random velocity variation" onClick={() => velocityTool("humanize")} />
                </EditGroup>
                <EditGroup label="History">
                  <IconBtn label="Undo (Ctrl+Z)" onClick={undo} disabled={historyLen === 0}>
                    <Undo2 className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={redoLen === 0}>
                    <Redo2 className="h-3.5 w-3.5" />
                  </IconBtn>
                </EditGroup>
                <button
                  type="button"
                  onClick={exportEdited}
                  disabled={historyLen === 0}
                  title={historyLen === 0 ? "Make an edit first" : "Download the MIDI with your edits applied"}
                  className="ml-auto flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-[11px] font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Export edited MIDI
                  {historyLen > 0 && (
                    <span className="rounded bg-black/20 px-1.5 py-px font-mono text-[10px]">
                      {historyLen}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 bg-black/20 px-3 py-1.5 text-[10.5px] text-white/45">
                <span><Kbd>drag</Kbd> move</span>
                <span><Kbd>edge</Kbd> resize</span>
                <span><Kbd>dbl-click</Kbd> add</span>
                <span><Kbd>Del</Kbd> delete</span>
                <span><Kbd>Space</Kbd> play</span>
                <span><Kbd>Ctrl</Kbd>+<Kbd>scroll</Kbd> zoom</span>
                <span><Kbd>Shift</Kbd>+<Kbd>scroll</Kbd> pan</span>
              </div>
            </div>
          )}

          {compare && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-full border border-white/10">
                {[
                  { v: 0, l: "Original" },
                  { v: 0.5, l: "Both" },
                  { v: 1, l: "MIDI" },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    onClick={() => applyMix(o.v, true)}
                    title={o.v === 0 ? "Hear only your original audio" : o.v === 1 ? "Hear only the transcribed MIDI" : "Hear both at equal level"}
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
                aria-label="Crossfade between original audio and MIDI"
                className="af-midi-range flex-1"
                onChange={(e) => applyMix(Number(e.target.value) / 100, true)}
              />
              <span className="w-14 shrink-0 text-[11px] text-white/50">MIDI</span>
              {!originalReady && (
                <span className="flex items-center gap-1 text-[11px] text-white/40">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                </span>
              )}
            </div>
          )}

          {data.tracks.length > 1 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {data.tracks.map((track, ti) => {
                const dim = soloed.size > 0 ? !soloed.has(ti) : muted.has(ti);
                return (
                  <div
                    key={ti}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-2 pr-1 text-[11px]",
                      dim && "opacity-45"
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: track.color }}
                    />
                    <span className="max-w-[110px] truncate text-white/75">
                      {track.name}
                    </span>
                    <span className="text-white/35">{track.notes.length}</span>
                    <button
                      type="button"
                      aria-label={`Mute ${track.name}`}
                      onClick={() => toggleMute(ti)}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-white/10",
                        muted.has(ti) ? "text-rose-400" : "text-white/45"
                      )}
                    >
                      <VolumeX className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Solo ${track.name}`}
                      onClick={() => toggleSolo(ti)}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-white/10",
                        soloed.has(ti) ? "text-amber-400" : "text-white/45"
                      )}
                    >
                      <Headphones className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <style>{`
        .af-midi-range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.12);
          outline: none;
        }
        .af-midi-range::-webkit-slider-thumb {
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
        .af-midi-range::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .af-midi-range::-moz-range-thumb {
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

function ToolChip({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="h-8 rounded-md border border-white/10 bg-black/30 px-2.5 text-[11px] font-medium text-white/75 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 active:scale-95"
    >
      {label}
    </button>
  );
}

function EditGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
        {label}
      </span>
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 py-px font-mono text-[10px] text-white/65">
      {children}
    </kbd>
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

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 40);
  const g = Math.min(255, ((n >> 8) & 255) + 40);
  const b = Math.min(255, (n & 255) + 40);
  return `rgb(${r},${g},${b})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}