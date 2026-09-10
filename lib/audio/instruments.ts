import type { Channel } from "tone";

type ToneModule = typeof import("tone");

export type ToneInstr = {
  triggerAttackRelease: (
    note: number,
    duration: number,
    time: number,
    velocity: number
  ) => unknown;
  releaseAll: () => unknown;
  dispose: () => unknown;
  connect: (node: Channel) => unknown;
};

/* Guards every trigger behind sample readiness so a sampler never throws
 * "buffer is either not set or not loaded" while its samples stream in. */
export type Instrument = {
  ready: boolean;
  triggerAttackRelease: ToneInstr["triggerAttackRelease"];
  releaseAll: () => void;
  dispose: () => void;
  connect: ToneInstr["connect"];
};

export function guard(inner: ToneInstr): Instrument {
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


export type InstrumentKind = "piano" | "epiano" | "pluck" | "saw" | "bass";

export const INSTRUMENTS: { key: InstrumentKind; label: string }[] = [
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

export function makeInstrument(
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

/* Equal-power crossfade; when compare is off the original is fully silent. */
export function mixGains(mix: number, compare: boolean) {
  if (!compare) return { midi: 1, orig: 0 };
  const a = mix * (Math.PI / 2);
  return { midi: Math.sin(a), orig: Math.cos(a) };
}