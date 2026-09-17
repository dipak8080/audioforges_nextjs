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
      note: "htdemucs · 25 sec",
      src: `${BASE}/af-standard-${stem}.mp3`,
    },
    {
      id: "af-studio",
      title: "AF Studio",
      note: "MelBand RoFormer · 1m 02s",
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
                ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-graphite-700 bg-graphite-900/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">LALAL.AI</p>
          <p className="text-xs text-text-subtle">
            Preview only on the free plan, so there is no file to compare. Checked 17 Sept 2026.
          </p>
        </div>
      </div>
    </div>
  );
}