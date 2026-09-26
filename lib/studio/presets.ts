import type { MeteredToolKey } from "@/lib/types/credits";
import type { StudioConfig } from "./config";

export type StemOutput = 2 | 4 | 6;
export type InputSource = "file" | "link";

export interface StudioSelection {
  output: StemOutput;
  dereverb: boolean;
  leadBack: boolean;
}

export type StudioPresetKey =
  | "vocal-remover"
  | "stems"
  | "echo-reverb"
  | "lead-backing"
  | "acapella"
  | "instrumental"
  | "drum-remover"
  | "bass-remover"
  | "youtube-vocal-remover"
  | "youtube-stems";

export interface StudioPreset extends StudioSelection {
  source: InputSource;
}

export const STUDIO_PRESETS: Record<StudioPresetKey, StudioPreset> = {
  "vocal-remover": { output: 2, dereverb: false, leadBack: false, source: "file" },
  stems: { output: 4, dereverb: false, leadBack: false, source: "file" },
  "echo-reverb": { output: 2, dereverb: true, leadBack: false, source: "file" },
  "lead-backing": { output: 2, dereverb: false, leadBack: true, source: "file" },
  acapella: { output: 2, dereverb: false, leadBack: false, source: "file" },
  instrumental: { output: 2, dereverb: false, leadBack: false, source: "file" },
  "drum-remover": { output: 4, dereverb: false, leadBack: false, source: "file" },
  "bass-remover": { output: 4, dereverb: false, leadBack: false, source: "file" },
  "youtube-vocal-remover": { output: 2, dereverb: false, leadBack: false, source: "link" },
  "youtube-stems": { output: 4, dereverb: false, leadBack: false, source: "link" },
};

export function studioTool(output: StemOutput, source: InputSource): MeteredToolKey {
  const base = output === 2 ? "separate-hq" : "stems-hq";
  return (source === "link" ? `youtube/${base}` : base) as MeteredToolKey;
}

export function vocalOptionsOf(s: StudioSelection): string[] {
  return [s.dereverb && "dereverb", s.leadBack && "lead_back"].filter(Boolean) as string[];
}

export function stemCountOf(s: StudioSelection): 4 | 6 {
  return s.output === 6 ? 6 : 4;
}

export function sanitizeSelection(s: StudioSelection, config: StudioConfig): StudioSelection {
  return {
    output: s.output === 6 && !config.sixStems ? 4 : s.output,
    dereverb: s.dereverb && config.vocalOptions,
    leadBack: s.leadBack && config.vocalOptions,
  };
}

export function estimateSongs(s: StudioSelection, config: StudioConfig, passHolder = false): number {
  const options = vocalOptionsOf(s).length * config.optionSongs;
  const six = s.output === 6 ? config.sixStemSongs : 0;
  return 1 + (passHolder && config.pass.optionsIncluded ? 0 : options) + six;
}