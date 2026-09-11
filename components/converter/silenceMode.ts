import type { CardOption } from "./ToolControls";

export type DetectionMode = "music" | "speech";

export const MODE_OPTIONS: ReadonlyArray<CardOption<DetectionMode>> = [
  {
    value: "music",
    title: "Music",
    detail: "Finds gaps by level. Anything below the threshold counts as silence.",
    footnote: "Vinyl rips, mixes, voice memos",
  },
  {
    value: "speech",
    title: "Speech",
    detail: "Silero VAD finds where someone stops talking, whatever else is in the audio.",
    footnote: "Podcasts, interviews, narration",
  },
];