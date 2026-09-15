import type { MeteredToolKey, PaywallToolRule } from "@/lib/types/credits";

export interface PaidJob {
  id: string;
  label: string;
  short: string;
  detail: string;
  credits: number;
  keys: MeteredToolKey[];
}

const GROUPS: Array<Omit<PaidJob, "credits">> = [
  {
    id: "separation",
    short: "Studio separation",
    label: "Studio Quality separation",
    detail: "Vocal remover or stem splitter, file or YouTube link",
    keys: ["separate-hq", "stems-hq", "youtube/separate-hq", "youtube/stems-hq"],
  },
  {
    id: "transcribe",
    short: "transcription",
    label: "Transcription",
    detail: "Audio, video or YouTube to text",
    keys: ["transcribe"],
  },
  {
    id: "midi",
    short: "MIDI",
    label: "Piano or guitar MIDI",
    detail: "One instrument, high accuracy",
    keys: ["audio-to-midi-hq"],
  },
  {
    id: "midi-mix",
    short: "MIDI",
    label: "Full-mix MIDI",
    detail: "Every instrument on its own track",
    keys: ["audio-to-midi-hq-mix"],
  },
  {
    id: "sheet",
    short: "sheet music",
    label: "Sheet music",
    detail: "PDF, MusicXML, MIDI and SVG",
    keys: ["audio-to-sheet"],
  },
];

export function paidJobs(tools: Partial<Record<MeteredToolKey, PaywallToolRule>> | undefined): PaidJob[] {
  if (!tools) return [];
  const out: PaidJob[] = [];
  for (const group of GROUPS) {
    const live = group.keys.filter((k) => tools[k]?.enabled);
    if (!live.length) continue;
    const credits = Math.max(...live.map((k) => tools[k]?.credits ?? 1), 1);
    out.push({ ...group, keys: live, credits });
  }
  return out.sort((a, b) => a.credits - b.credits);
}

export function paidJobFor(jobs: PaidJob[], tool: string | null | undefined): PaidJob | null {
  if (!tool) return null;
  return jobs.find((j) => (j.keys as string[]).includes(tool)) ?? null;
}

export function joinNames(names: string[]): string {
  const unique = Array.from(new Set(names));
  if (unique.length <= 1) return unique[0] ?? "";
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}