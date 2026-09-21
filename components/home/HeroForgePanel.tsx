import { cn } from "@/lib/utils/cn";

const BARS = 84;

function shape(seed: number, density: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    const t = i / BARS;
    const env = 0.35 + 0.65 * Math.pow(Math.sin(t * Math.PI), 0.6);
    const a = Math.abs(Math.sin(i * 0.61 * seed + seed));
    const b = Math.abs(Math.cos(i * 1.37 + seed * 0.3));
    const c = Math.abs(Math.sin(i * 3.1 + seed));
    out.push(Math.min(1, env * (0.18 + (a * 0.5 + b * 0.35 + c * 0.15) * density)));
  }
  return out;
}

const LANES = [
  { name: "Vocals", peaks: shape(3, 0.9), active: true },
  { name: "Drums", peaks: shape(5, 1.1), active: false },
  { name: "Bass", peaks: shape(9, 0.7), active: false },
  { name: "Other", peaks: shape(13, 0.95), active: false },
];

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
        className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 shadow-2xl shadow-graphite-950/60"
      >
        <div className="flex items-center justify-between border-b border-graphite-800 px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-graphite-950">
              <svg viewBox="0 0 12 12" className="ml-px h-3 w-3 fill-current">
                <path d="M3 2l7 4-7 4z" />
              </svg>
            </span>
            <span className="text-xs font-semibold text-text-primary">Forge Mixer</span>
            <span className="font-mono text-[11px] tabular-nums text-text-subtle">1:24 / 3:41</span>
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
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              Studio Quality
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="divide-y divide-graphite-800">
            {LANES.map((lane) => (
              <div key={lane.name} className="flex items-stretch">
                <div className="flex w-24 shrink-0 flex-col justify-center border-r border-graphite-800 px-3 py-2.5">
                  <p className="text-xs font-medium text-text-primary">{lane.name}</p>
                  <div className="mt-1.5 flex gap-1">
                    <span className="rounded border border-graphite-700 px-1.5 text-[10px] leading-4 text-text-subtle">
                      M
                    </span>
                    <span
                      className={cn(
                        "rounded border px-1.5 text-[10px] leading-4",
                        lane.active
                          ? "border-amber-500/60 bg-amber-500/15 text-amber-400"
                          : "border-graphite-700 text-text-subtle"
                      )}
                    >
                      S
                    </span>
                  </div>
                </div>
                <div className="relative h-12 flex-1">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-graphite-700" />
                  <div className="absolute inset-0 flex items-center gap-px px-2">
                    {lane.peaks.map((p, i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-full rounded-[0.5px]",
                          lane.active ? "bg-amber-400/85" : "bg-graphite-500"
                        )}
                        style={{ height: `${Math.max(3, p * 86)}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-24 right-0">
            <span
              className="absolute inset-0 will-change-transform"
              style={{ animation: "af-playhead 9s linear infinite" }}
            >
              <span className="absolute inset-y-0 left-0 w-px bg-amber-400/90 shadow-[0_0_8px_rgba(240,184,98,0.8)]" />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-graphite-800 bg-graphite-950/40 px-3 py-2">
          <div className="flex gap-1.5">
            {["Acapella", "Karaoke", "Custom mix"].map((p, i) => (
              <span
                key={p}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px]",
                  i === 0
                    ? "bg-amber-500 text-graphite-950"
                    : "border border-graphite-700 text-text-muted"
                )}
              >
                {p}
              </span>
            ))}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-subtle">
            Export WAV
          </span>
        </div>
      </div>

    </div>
  );
}