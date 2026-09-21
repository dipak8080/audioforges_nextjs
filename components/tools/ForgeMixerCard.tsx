import { cn } from "@/lib/utils/cn";

export interface Lane {
  name: string;
  peaks: number[];
  active?: boolean;
}

const BARS = 160;

export function shape(seed: number, density: number): number[] {
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

const STEM_COLORS = { vocal: "#e8a23d", drum: "#e0705c", bass: "#4dd8b8", other: "#cfcabd" };

function stemColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("vocal") || n.includes("voice")) return STEM_COLORS.vocal;
  if (n.includes("drum")) return STEM_COLORS.drum;
  if (n.includes("bass") || n.includes("instrument")) return STEM_COLORS.bass;
  return STEM_COLORS.other;
}

function Knob({ label, value, at }: { label: string; value: string; at: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle">
        {label}
        <span className="text-text-muted">{value}</span>
      </div>
      <div className="relative mt-2 h-0.5 rounded-full bg-graphite-600">
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary"
          style={{ left: `${at * 100}%` }}
        />
      </div>
    </div>
  );
}

function LaneRow({ lane, compact, first }: { lane: Lane; compact: boolean; first: boolean }) {
  const color = stemColor(lane.name);
  const cut = Math.floor(PLAYHEAD * lane.peaks.length);
  return (
    <div className={cn("flex flex-1 items-stretch", !first && "border-t border-graphite-800")}>
      <div
        className={cn(
          "shrink-0 border-r border-graphite-800 px-3 py-3",
          compact ? "w-24" : "w-28 sm:w-44"
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">{lane.name}</p>
          <span
            className={cn(
              "rounded border border-graphite-700 px-1.5 font-mono text-[9px] leading-4 text-text-subtle",
              compact ? "hidden" : "hidden sm:block"
            )}
          >
            M
          </span>
          <span
            className={cn(
              "rounded border px-1.5 font-mono text-[9px] leading-4",
              compact ? "hidden" : "hidden sm:block",
              lane.active
                ? "border-amber-500 bg-amber-500 text-graphite-950"
                : "border-graphite-700 text-text-subtle"
            )}
          >
            S
          </span>
        </div>
        <div className={cn("mt-3 grid-cols-[3fr_2fr] gap-3", compact ? "hidden" : "hidden sm:grid")}>
          <Knob label="Vol" value={lane.active ? "100" : "82"} at={lane.active ? 0.66 : 0.55} />
          <Knob label="Pan" value="C" at={0.5} />
        </div>
      </div>
      <div className={cn("relative flex-1", compact ? "min-h-12" : "min-h-16 sm:min-h-20")} aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.06]" />
        <div className="absolute inset-0 flex items-center gap-px px-1">
          {lane.peaks.map((p, i) => (
            <span
              key={i}
              className="w-full rounded-[0.5px]"
              style={{
                height: `${Math.max(3, p * 88)}%`,
                backgroundColor: color,
                opacity: i < cut ? 1 : 0.34,
              }}
            />
          ))}
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
  stackPoints = false,
  className,
}: {
  lanes?: Lane[];
  presets?: string[];
  points: string[];
  compact?: boolean;
  stackPoints?: boolean;
  className?: string;
}) {
  const ruler = compact
    ? ["0:00", "1:00", "2:00", "3:00"]
    : ["0:00", "0:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30"];
  const rulerSpan = compact ? 3.7 : 7.4;
  const strip = compact ? "left-24" : "left-28 sm:left-44";
  return (
    <div className={cn("surface grain overflow-hidden rounded-xl border border-graphite-800", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-4">
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
              <span className="text-lg text-amber-400">1:24</span>
              <span className="ml-1.5 text-[11px] text-text-subtle">/ 3:41</span>
            </p>
          </div>
        </div>
        <div className="flex rounded-full border border-graphite-700 bg-graphite-950/60 p-0.5">
          {["Original", ...presets].map((p, i) => (
            <span
              key={p}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                i === 1 ? "bg-graphite-700 text-text-primary" : "text-text-muted",
                compact && i === 0 && "hidden"
              )}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-3 mb-3 flex flex-1 flex-col overflow-hidden rounded-lg bg-graphite-950/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        <div
          className={cn(
            "flex h-6 items-end border-b border-graphite-800 text-[9px] text-text-subtle",
            compact ? "pl-24" : "pl-28 sm:pl-44"
          )}
          aria-hidden
        >
          <div className="relative h-full flex-1">
            {ruler.map((t, i) => (
              <span
                key={t}
                className="absolute bottom-0 flex h-full items-end border-l border-white/10 pb-1 pl-1 font-mono"
                style={{ left: `${(i / rulerSpan) * 100}%` }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        {lanes.map((l, i) => (
          <LaneRow key={l.name} lane={l} compact={compact} first={i === 0} />
        ))}
        <div className={cn("pointer-events-none absolute inset-y-0 right-0", strip)} aria-hidden>
          {ruler.map((t, i) => (
            <span
              key={t}
              className="absolute inset-y-0 w-px bg-white/[0.04]"
              style={{ left: `${(i / rulerSpan) * 100}%` }}
            />
          ))}
          <div
            className="absolute inset-y-0 border-x border-white/40 bg-white/[0.06]"
            style={{ left: `${(PLAYHEAD - 0.1) * 100}%`, width: "18%" }}
          />
          <div
            className="absolute inset-y-0 w-px bg-amber-400 shadow-[0_0_10px_rgba(232,162,61,0.7)]"
            style={{ left: `${PLAYHEAD * 100}%` }}
          />
        </div>
      </div>

      {points.length > 0 && (
        <ul
          className={cn(
            "grid gap-x-6 gap-y-3 border-t border-graphite-800 p-5 text-sm leading-relaxed text-text-muted",
            stackPoints ? "mt-auto" : "sm:grid-cols-2"
          )}
        >
          {points.map((pt) => (
            <li key={pt} className="flex gap-2.5">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-text-subtle" aria-hidden />
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}