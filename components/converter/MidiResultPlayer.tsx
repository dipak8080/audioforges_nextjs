"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import {
  Headphones,
  Pause,
  Play,
  Repeat,
  Square,
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

type Engine = {
  Tone: ToneModule;
  transport: ReturnType<ToneModule["getTransport"]>;
  synths: { releaseAll: () => void; dispose: () => void }[];
  channels: InstanceType<ToneModule["Channel"]>[];
  parts: { dispose: () => void }[];
  nodes: { dispose: () => void }[];
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
const KEYS_W = 46;
const RULER_H = 18;
const VEL_H = 44;
const BLACK_PC = new Set([1, 3, 6, 8, 10]);
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FOLLOW_TO = 0.28;

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

export function MidiResultPlayer({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<ParsedMidi | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempoPct, setTempoPct] = useState(100);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState<Set<number>>(new Set());
  const [soloed, setSoloed] = useState<Set<number>>(new Set());

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
  const dirtyRef = useRef(true);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const tempoRef = useRef(100);
  const seekingRef = useRef(false);
  const mutedRef = useRef(muted);
  const soloedRef = useRef(soloed);

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
    const rows = d.hiPitch - d.loPitch + 1;
    const rowH = plotH / rows;
    const yFor = (p: number) => RULER_H + plotH - (p - d.loPitch + 1) * rowH;
    const xFor = (t: number) => KEYS_W + (t - view0) * ppt;
    const isBlack = (p: number) => BLACK_PC.has(p % 12);

    /* plot background + row striping */
    ctx.fillStyle = "#111114";
    ctx.fillRect(KEYS_W, RULER_H, plotW, plotH);

    for (let p = d.loPitch; p <= d.hiPitch; p++) {
      const y = yFor(p);
      if (isBlack(p)) {
        ctx.fillStyle = "rgba(0,0,0,0.42)";
        ctx.fillRect(KEYS_W, y, plotW, rowH);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.022)";
        ctx.fillRect(KEYS_W, y, plotW, rowH);
      }
      if (rowH >= 4) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(KEYS_W, y + rowH - 0.5, plotW, 0.5);
      }
      if (p % 12 === 0) {
        ctx.fillStyle = "rgba(251,191,36,0.16)";
        ctx.fillRect(KEYS_W, y + rowH - 1, plotW, 1);
      }
    }

    /* ruler strip */
    ctx.fillStyle = "#0d0d10";
    ctx.fillRect(0, 0, w, RULER_H);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(0, RULER_H - 1, w, 1);

    const beat = Math.max(1, d.ppq);
    const bar = beat * Math.max(1, d.beatsPerBar);
    const sixteenth = Math.max(1, Math.round(beat / 4));
    const beatPx = beat * ppt;
    const barPx = bar * ppt;
    const step = sixteenth * ppt >= 9 ? sixteenth : beatPx > 11 ? beat : bar;
    const labelEvery = barPx > 44 ? bar : bar * Math.ceil(48 / Math.max(1, barPx));
    ctx.font = "600 9px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    if (step * ppt >= 2) {
      let guard = Math.ceil(plotW / (step * ppt)) + 2;
      for (let t = Math.floor(view0 / step) * step; t <= view1 && guard > 0; t += step, guard--) {
        if (t < 0) continue;
        const x = xFor(t);
        const isBar = t % bar === 0;
        const isBeat = t % beat === 0;
        ctx.fillStyle = isBar
          ? "rgba(255,255,255,0.14)"
          : isBeat
            ? "rgba(255,255,255,0.055)"
            : "rgba(255,255,255,0.025)";
        ctx.fillRect(x, RULER_H, 1, plotH);
        if (isBeat) {
          ctx.fillStyle = isBar ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)";
          ctx.fillRect(x, RULER_H - (isBar ? 7 : 4), 1, isBar ? 7 : 4);
        }
        if (isBar && t % labelEvery === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText(String(Math.round(t / bar) + 1), x + 4, RULER_H / 2 - 0.5);
        }
      }
    }

    /* notes */
    const now = posRef.current;
    const solo = soloedRef.current;
    const mute = mutedRef.current;
    const noteH = Math.max(2.5, rowH - Math.min(2, rowH * 0.18));
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
        ctx.fillStyle = active ? track.bright : track.color;
        if (active && fancy) {
          ctx.shadowColor = track.bright;
          ctx.shadowBlur = 5;
        }
        roundRect(ctx, x, y, nw, noteH, r);
        ctx.shadowBlur = 0;
        if (fancy && nw >= 4 && noteH >= 4 && audible) {
          ctx.globalAlpha = active ? 0.9 : 0.55;
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x + 0.5, y + 0.5, nw - 1, noteH - 1, r);
          ctx.stroke();
          ctx.globalAlpha = active ? 0.8 : 0.32;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(x + 1, y + 1, Math.max(1, nw - 2), 1);
        }
        if (fancy && audible && noteH >= 8) {
          const label = NAMES[n.p % 12] + (Math.floor(n.p / 12) - 1);
          if (nw >= label.length * 5.5 + 6) {
            ctx.globalAlpha = active ? 0.95 : 0.8;
            ctx.fillStyle = "rgba(20,12,0,0.85)";
            ctx.font = "700 8px ui-monospace, monospace";
            ctx.fillText(label, x + 3, y + noteH / 2 + 0.5);
          }
        }
        if (audible) velNotes.push({ x, v: n.v, color: track.color, active });
      }
    });
    ctx.globalAlpha = 1;

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
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = "600 7px ui-monospace, monospace";
    ctx.fillText("VELOCITY", 5, velTop + 8);
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

    if (px >= KEYS_W - 6 && px <= w + 6) {
      ctx.fillStyle = "rgba(251,191,36,0.95)";
      ctx.beginPath();
      ctx.moveTo(px - 4.5, RULER_H - 7);
      ctx.lineTo(px + 6, RULER_H - 7);
      ctx.lineTo(px + 0.75, RULER_H - 0.5);
      ctx.closePath();
      ctx.fill();
    }

    /* piano keyboard gutter — real key geometry */
    ctx.fillStyle = "#0c0c0f";
    ctx.fillRect(0, RULER_H, KEYS_W, plotH);

    const keyGrad = ctx.createLinearGradient(0, 0, KEYS_W, 0);
    keyGrad.addColorStop(0, "#f3f1ec");
    keyGrad.addColorStop(0.85, "#e6e3dc");
    keyGrad.addColorStop(1, "#d4d0c7");
    const litGrad = ctx.createLinearGradient(0, 0, KEYS_W, 0);
    litGrad.addColorStop(0, "#fbbf24");
    litGrad.addColorStop(1, "#f59e0b");

    const inRange = (p: number) => p >= d.loPitch && p <= d.hiPitch;
    for (let p = d.loPitch; p <= d.hiPitch; p++) {
      if (isBlack(p)) continue;
      const lit = activePitches.has(p);
      const top = yFor(p) - (inRange(p + 1) && isBlack(p + 1) ? rowH / 2 : 0);
      const bottom =
        yFor(p) + rowH + (inRange(p - 1) && isBlack(p - 1) ? rowH / 2 : 0);
      ctx.fillStyle = lit ? litGrad : keyGrad;
      ctx.fillRect(0, top, KEYS_W - 1, bottom - top);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, bottom - 0.5, KEYS_W - 1, 0.5);
      const isC = p % 12 === 0;
      if ((isC && rowH >= 3.5) || rowH >= 8) {
        ctx.fillStyle = lit
          ? "rgba(0,0,0,0.8)"
          : isC
            ? "rgba(60,55,45,0.9)"
            : "rgba(60,55,45,0.5)";
        ctx.font = `${isC ? 700 : 600} ${isC ? 8.5 : 7.5}px ui-monospace, monospace`;
        ctx.textAlign = "right";
        ctx.fillText(NAMES[p % 12] + (Math.floor(p / 12) - 1), KEYS_W - 4, (top + bottom) / 2 + 0.5);
        ctx.textAlign = "left";
      }
    }
    for (let p = d.loPitch; p <= d.hiPitch; p++) {
      if (!isBlack(p)) continue;
      const lit = activePitches.has(p);
      const y = yFor(p);
      const inset = Math.min(0.75, rowH * 0.08);
      ctx.fillStyle = lit ? "#f59e0b" : "#141418";
      ctx.fillRect(0, y + inset, KEYS_W * 0.58, rowH - inset * 2);
      if (rowH >= 5) {
        ctx.fillStyle = lit ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.07)";
        ctx.fillRect(KEYS_W * 0.58 - 1, y + inset, 1, rowH - inset * 2);
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(KEYS_W - 1, RULER_H, 1, plotH);
    const keyShadow = ctx.createLinearGradient(KEYS_W, 0, KEYS_W + 9, 0);
    keyShadow.addColorStop(0, "rgba(0,0,0,0.32)");
    keyShadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = keyShadow;
    ctx.fillRect(KEYS_W, RULER_H, 9, plotH);
  }, []);

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
      const h = Math.min(500, Math.max(320, (d.hiPitch - d.loPitch + 1) * 10 + RULER_H + VEL_H));
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
    transport.loopStart = 0;
    transport.loopEnd = `${d.durationTicks}i`;

    const limiter = new Tone.Limiter(-1).toDestination();
    const master = new Tone.Volume(-6).connect(limiter);

    const synths: Engine["synths"] = [];
    const channels: Engine["channels"] = [];
    const parts: Engine["parts"] = [];

    d.tracks.forEach((track, ti) => {
      const channel = new Tone.Channel({
        mute: mutedRef.current.has(ti),
        solo: soloedRef.current.has(ti),
      }).connect(master);
      channels.push(channel);

      const synth = track.percussion
        ? new Tone.PolySynth(Tone.MembraneSynth, {
            envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
          })
        : new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: ti % 2 === 0 ? "triangle" : "fatsawtooth" },
            envelope: { attack: 0.004, decay: 0.15, sustain: 0.5, release: 0.25 },
          });
      synth.maxPolyphony = 48;
      synth.connect(channel);
      synths.push(synth);

      const part = new Tone.Part(
        (time, ev: PlayerNote) => {
          const bpmNow = transport.bpm.value;
          const durSec = Math.max(MIN_NOTE_SEC, (ev.d / d.ppq) * (60 / bpmNow));
          synth.triggerAttackRelease(
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

    transport.scheduleRepeat(
      () => {
        if (!loopRef.current && transport.ticks >= d.durationTicks - 1) {
          transport.pause();
          synths.forEach((s) => s.releaseAll());
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

    const eng: Engine = {
      Tone,
      transport,
      synths,
      channels,
      parts,
      nodes: [limiter, master],
    };
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
      eng.parts.forEach((p) => p.dispose());
      eng.synths.forEach((s) => s.dispose());
      eng.channels.forEach((c) => {
        c.solo = false;
        c.dispose();
      });
      eng.nodes.forEach((n) => n.dispose());
      engineRef.current = null;
    };
  }, []);

  /* ---------- transport actions ---------- */
  const togglePlay = async () => {
    const eng = await ensureEngine();
    if (playingRef.current) {
      eng.transport.pause();
      eng.synths.forEach((s) => s.releaseAll());
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
      eng.synths.forEach((s) => s.releaseAll());
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
    }
    syncTimeUi();
    dirtyRef.current = true;
  };

  const setTempo = (pct: number) => {
    tempoRef.current = pct;
    setTempoPct(pct);
    const eng = engineRef.current;
    const d = dataRef.current;
    if (eng && d) eng.transport.bpm.value = d.baseBpm * (pct / 100);
    syncTimeUi();
  };

  const toggleLoop = () => {
    const next = !loopRef.current;
    loopRef.current = next;
    setLoop(next);
    const eng = engineRef.current;
    if (eng) eng.transport.loop = next;
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

  const pointer = useRef<{ x: number; startX: number; panned: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointer.current = { x: e.clientX, startX: e.clientX, panned: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointer.current;
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!p || !canvas || !d) return;
    const dx = e.clientX - p.x;
    p.x = e.clientX;
    if (Math.abs(e.clientX - p.startX) > 4) p.panned = true;
    if (p.panned) {
      const plotW = Math.max(1, canvas.width / (window.devicePixelRatio || 1) - KEYS_W);
      scrollRef.current = clampScroll(
        scrollRef.current - dx / pxPerTickRef.current,
        d,
        plotW / pxPerTickRef.current
      );
      dirtyRef.current = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-white/50">
          Listen before you download
        </p>
        {status === "ready" && (
          <div className="flex items-center gap-1">
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
          <div ref={wrapRef} className="w-full">
            <canvas
              ref={canvasRef}
              className="w-full cursor-grab touch-none rounded-lg border border-white/10 bg-black/30 active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            />
          </div>

          <div className="mt-2.5 flex items-center gap-2.5">
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
            <IconBtn label="Stop" onClick={stop}>
              <Square className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Loop" onClick={toggleLoop} active={loop}>
              <Repeat className="h-3.5 w-3.5" />
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

function IconBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 transition hover:bg-white/10 active:scale-95",
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