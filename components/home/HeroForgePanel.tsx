import { cn } from "@/lib/utils/cn";
import {
  HERO_PEAKS_BASS,
  HERO_PEAKS_DRUMS,
  HERO_PEAKS_OTHER,
  HERO_PEAKS_VOCALS,
} from "@/lib/data/hero-stem-peaks";


const LANES = [
  { name: "Vocals", peaks: HERO_PEAKS_VOCALS, color: "#e8a23d" },
  { name: "Drums", peaks: HERO_PEAKS_DRUMS, color: "#e0705c" },
  { name: "Bass", peaks: HERO_PEAKS_BASS, color: "#4dd8b8" },
  { name: "Other", peaks: HERO_PEAKS_OTHER, color: "#cfcabd" },
];

const RULER = ["0:00", "0:10", "0:20", "0:30", "0:40"];

export function HeroForgePanel() {
  return (
    <div className="relative">
      <style>{`@keyframes af-playhead{0%{transform:translateX(2%)}100%{transform:translateX(98%)}}@keyframes af-eq{0%,100%{transform:scaleY(.3);opacity:.6}50%{transform:scaleY(1);opacity:1}}`}</style>
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 hidden rounded-[2rem] bg-amber-500/[0.06] blur-3xl lg:block"
      />

      <div
        aria-hidden
        className="surface grain overflow-hidden rounded-xl border border-graphite-800 shadow-2xl shadow-graphite-950/60"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-graphite-950">
              <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
                <path d="M2.5 2h2.5v8H2.5zM7 2h2.5v8H7z" />
              </svg>
            </span>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-subtle">
                Forge Mixer
              </p>
              <p className="mt-0.5 font-mono tabular-nums leading-none">
                <span className="text-lg text-amber-400">0:19</span>
                <span className="ml-1.5 text-[11px] text-text-subtle">/ 0:50</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-4 items-end gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-full w-[3px] origin-bottom rounded-full bg-amber-500 will-change-transform"
                  style={{ animation: `af-eq 0.9s ease-in-out ${i * 0.12}s infinite` }}
                />
              ))}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-medium text-graphite-950">
              Studio Quality
            </span>
          </div>
        </div>

        <div className="relative mx-3 overflow-hidden rounded-lg bg-graphite-950/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="relative h-6 border-b border-graphite-800 pl-24">
            <div className="relative h-full">
              {RULER.map((t, i) => (
                <span
                  key={t}
                  className="absolute bottom-0 flex h-full items-end border-l border-white/10 pb-1 pl-1 font-mono text-[9px] text-text-subtle"
                  style={{ left: `${(i / 5) * 100}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {LANES.map((lane, index) => (
            <div
              key={lane.name}
              className={cn("flex items-stretch", index > 0 && "border-t border-graphite-800")}
            >
              <div className="flex w-24 shrink-0 items-center gap-1.5 border-r border-graphite-800 px-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: lane.color }} />
                <p className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">
                  {lane.name}
                </p>
              </div>
              <div className="relative h-12 flex-1">
                <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.06]" />
                <div className="absolute inset-0 flex items-center gap-px px-1">
                  {lane.peaks.map((p, i) => (
                    <span
                      key={i}
                      className="w-full rounded-[0.5px]"
                      style={{ height: `${Math.max(3, p * 86)}%`, backgroundColor: lane.color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="pointer-events-none absolute inset-y-0 left-24 right-0 overflow-hidden">
            {RULER.map((t, i) => (
              <span
                key={t}
                className="absolute inset-y-0 w-px bg-white/[0.04]"
                style={{ left: `${(i / 5) * 100}%` }}
              />
            ))}
            <span
              className="absolute inset-0 will-change-transform"
              style={{ animation: "af-playhead 9s linear infinite" }}
            >
              <span className="absolute inset-y-0 left-0 w-full bg-graphite-950/65" />
              <span className="absolute inset-y-0 left-0 w-px bg-amber-400 shadow-[0_0_10px_rgba(232,162,61,0.7)]" />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex rounded-full border border-graphite-700 bg-graphite-950/60 p-0.5">
            {["Original", "Karaoke", "Acapella"].map((p, i) => (
              <span
                key={p}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  i === 0 ? "bg-graphite-700 text-text-primary" : "text-text-muted"
                )}
              >
                {p}
              </span>
            ))}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
            Export WAV
          </span>
        </div>
      </div>
    </div>
  );
}