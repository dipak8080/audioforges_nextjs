import { cn } from "@/lib/utils/cn";

interface Lane {
  name: string;
  peaks: number[];
  active?: boolean;
}

const BARS = 160;

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

const DEFAULT_LANES: Lane[] = [
  { name: "Vocals", peaks: shape(3, 0.9), active: true },
  { name: "Instrumental", peaks: shape(7, 1.05) },
];

const PLAYHEAD = 0.38;

function LaneRow({ lane, compact }: { lane: Lane; compact: boolean }) {
  return (
    <div className="flex items-stretch">
      <div
        className={cn(
          "flex shrink-0 flex-col justify-center border-r border-graphite-800 px-3 py-3",
          compact ? "w-24" : "w-28 sm:w-32"
        )}
      >
        <p className="text-xs font-medium text-text-primary">{lane.name}</p>
        <div className="mt-1.5 flex gap-1">
          <span className="rounded border border-graphite-700 px-1.5 text-[10px] leading-4 text-text-subtle">M</span>
          <span
            className={cn(
              "rounded border px-1.5 text-[10px] leading-4",
              lane.active ? "border-amber-500/60 bg-amber-500/15 text-amber-400" : "border-graphite-700 text-text-subtle"
            )}
          >
            S
          </span>
          <span className="ml-auto h-1 w-8 self-center overflow-hidden rounded-full bg-graphite-800">
            <span className={cn("block h-full rounded-full", lane.active ? "w-3/4 bg-amber-500" : "w-1/3 bg-graphite-600")} />
          </span>
        </div>
      </div>
      <div className="relative h-16 flex-1" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-graphite-700" />
        <div className="absolute inset-0 flex items-center gap-px px-2">
          {lane.peaks.map((p, i) => (
            <span
              key={i}
              className={cn("w-full rounded-[0.5px]", lane.active ? "bg-amber-400/85" : "bg-graphite-500")}
              style={{ height: `${Math.max(3, p * 88)}%` }}
            />
          ))}
        </div>
      </div>
      <div
        className={cn(
          "w-24 shrink-0 flex-col justify-center border-l border-graphite-800 px-3",
          compact ? "hidden" : "hidden sm:flex"
        )}
      >
        <div className="relative h-1 rounded-full bg-graphite-700">
          <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-graphite-500 bg-graphite-900" />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-text-subtle">
          <span>L</span>
          <span>pan</span>
          <span>R</span>
        </div>
      </div>
    </div>
  );
}

export function ForgeMixerCard({
  lanes = DEFAULT_LANES,
  presets = ["Karaoke", "Acapella"],
  points,
  compact = false,
}: {
  lanes?: Lane[];
  presets?: string[];
  points: string[];
  /** For narrow columns: shorter label gutter, no pan column, sparser ruler. */
  compact?: boolean;
}) {
  const ruler = compact ? ["0:00", "1:00", "2:00", "3:00"] : ["0:00", "0:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30"];
  const rulerSpan = compact ? 3.7 : 7.4;
  return (
    <div className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
      <div className="flex items-center justify-between border-b border-graphite-800 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-graphite-950">
            <svg viewBox="0 0 12 12" className="ml-px h-3 w-3 fill-current"><path d="M3 2l7 4-7 4z" /></svg>
          </span>
          <span className="text-xs font-semibold text-text-primary">Forge Mixer</span>
          <span className="font-mono text-[11px] tabular-nums text-text-subtle">1:24 / 3:41</span>
        </div>
        <div className="flex gap-1.5">
          {presets.map((p, i) => (
            <span
              key={p}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px]",
                i === 0 ? "bg-amber-500 text-graphite-950" : "border border-graphite-700 text-text-muted"
              )}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <div
          className={cn(
            "flex h-5 items-end border-b border-graphite-800 text-[9px] text-text-subtle",
            compact ? "pl-24" : "pl-28 sm:pl-32"
          )}
          aria-hidden
        >
          <div className="relative flex-1">
            {ruler.map((t, i) => (
              <span
                key={t}
                className={cn("absolute bottom-0.5 font-mono", i === 0 ? "translate-x-1" : "-translate-x-1/2")}
                style={{ left: `${(i / rulerSpan) * 100}%` }}
              >
                {t}
              </span>
            ))}
          </div>
          {!compact && <div className="hidden w-24 sm:block" />}
        </div>
        <div className="divide-y divide-graphite-800">
          {lanes.map((l) => (
            <LaneRow key={l.name} lane={l} compact={compact} />
          ))}
        </div>
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 top-0 right-0",
            compact ? "left-24" : "left-28 sm:left-32 sm:right-24"
          )}
          aria-hidden
        >
          <div className="absolute inset-y-0 w-px bg-text-primary/80" style={{ left: `${PLAYHEAD * 100}%` }} />
          <div
            className="absolute inset-y-5 border-x border-amber-500/50 bg-amber-500/[0.07]"
            style={{ left: `${(PLAYHEAD - 0.1) * 100}%`, width: "18%" }}
          />
        </div>
      </div>

      <ul className="grid gap-x-6 gap-y-3 border-t border-graphite-800 p-5 text-sm leading-relaxed text-text-muted sm:grid-cols-2">
        {points.map((pt) => (
          <li key={pt} className="flex gap-2.5">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-amber-400" aria-hidden />
            <span>{pt}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}