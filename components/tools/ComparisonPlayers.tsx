"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { CompareRig, type CompareLane } from "@/components/credits/CompareRig";

const BASE = "/audio/compare";

type Stem = "vocals" | "instrumental";

function lanesFor(stem: Stem): CompareLane[] {
  return [
    { id: "original", title: "Original", note: "The mix, untouched", src: `${BASE}/original.mp3` },
    {
      id: "af-standard",
      title: "AF Standard",
      note: "Forge 1 · 25 sec",
      src: `${BASE}/af-standard-${stem}.mp3`,
    },
    {
      id: "af-studio",
      title: "AF Studio",
      note: "Forge 2 · 1m 02s",
      src: `${BASE}/af-studio-${stem}.mp3`,
    },
    {
      id: "uvr",
      title: "UVR 5.6",
      note: "MDX23C · 19m 09s on CPU",
      src: `${BASE}/uvr-mdx23c-${stem}.mp3`,
    },
    {
      id: "vr",
      title: "VR.org",
      note: "Model not disclosed · ~15 sec",
      src: `${BASE}/vr-${stem}.mp3`,
    },
    {
      id: "lalal",
      title: "LALAL.AI",
      note: "Andromeda · preview recording",
      src: `${BASE}/lalal-${stem}.mp3`,
    },
  ];
}

export function ComparisonPlayers() {
  const [stem, setStem] = useState<Stem>("vocals");

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5" role="tablist" aria-label="Which stem to compare">
        {(["vocals", "instrumental"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={stem === s}
            onClick={() => setStem(s)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
              stem === s
                ? "border-graphite-600 bg-graphite-700 text-text-primary"
                : "border-graphite-700 text-text-muted hover:border-graphite-600 hover:text-text-primary"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <CompareRig
        key={stem}
        lanes={lanesFor(stem)}
        headline={stem === "vocals" ? "Vocals, every tool" : "Instrumental, every tool"}
        subline="Click a lane to switch while it plays. Drag on a lane to loop a section."
      />

      <p className="px-1 text-xs leading-relaxed text-text-subtle">
        LALAL.AI has no download on its free plan, so its lane is a recording of the preview player,
        made 21 Sept 2026. Every other lane is the file the tool returned.
      </p>
    </div>
  );
}