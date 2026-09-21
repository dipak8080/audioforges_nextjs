import { cn } from "@/lib/utils/cn";

/** [start (in 16ths), length, pitch row from top, velocity 0-1, offKey?] */
type Note = [number, number, number, number, boolean?];

const STEPS = 64;
const ROWS = 14;

// A short deterministic phrase. One note is marked off-key so the red flag
// treatment the copy describes is actually visible.
const NOTES: Note[] = [
  [0, 4, 9, 0.8],
  [4, 2, 7, 0.62],
  [6, 2, 6, 0.55],
  [8, 6, 4, 0.9],
  [15, 1, 5, 0.35, true],
  [16, 4, 6, 0.7],
  [20, 4, 4, 0.75],
  [24, 8, 2, 0.95],
  [32, 4, 9, 0.8],
  [36, 2, 7, 0.6],
  [38, 2, 6, 0.58],
  [40, 6, 4, 0.88],
  [48, 4, 3, 0.72],
  [52, 4, 5, 0.66],
  [56, 8, 2, 0.9],
];

/** Rows that are black keys, top row first. */
const BLACK = new Set([1, 3, 6, 8, 10, 13]);

const PLAYHEAD = 26 / STEPS;

export function PianoRollCard({
  title = "Forge Roll",
  meta = "Sung melody · A minor · 96 BPM",
  points,
  className,
  stackPoints = false,
}: {
  title?: string;
  meta?: string;
  points: string[];
  className?: string;
  /** Single-column bullets pinned to the card bottom (needs a flex-col className). */
  stackPoints?: boolean;
}) {
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
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-subtle">{title}</p>
            <p className="mt-0.5 font-mono text-[11px] text-text-muted">{meta}</p>
          </div>
        </div>
        <div className="flex rounded-full border border-graphite-700 bg-graphite-950/60 p-0.5">
          {["Piano", "Original", "Quantize"].map((label, i) => (
            <span
              key={label}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                i === 0 ? "bg-graphite-700 text-text-primary" : "text-text-muted"
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="mx-3 mb-3 flex overflow-hidden rounded-lg bg-graphite-950/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        aria-hidden
      >
        <div className="w-9 shrink-0 border-r border-graphite-800">
          {Array.from({ length: ROWS }, (_, r) => (
            <div
              key={r}
              className={cn(
                "h-[13px] border-b border-graphite-950",
                BLACK.has(r) ? "bg-graphite-950" : "bg-[#b8b4aa]"
              )}
            />
          ))}
          <div className="h-9 border-t border-graphite-800" />
        </div>

        <div className="relative flex-1">
          {/* Note grid */}
          <div className="relative" style={{ height: ROWS * 13 }}>
            {Array.from({ length: ROWS }, (_, r) => (
              <div
                key={r}
                className={cn("h-[13px] border-b border-white/[0.03]", BLACK.has(r) && "bg-black/30")}
              />
            ))}
            {/* Bar lines every 16 steps, beat lines every 4 */}
            <div className="absolute inset-0">
              {Array.from({ length: STEPS / 4 + 1 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "absolute inset-y-0 w-px",
                    i % 4 === 0 ? "bg-white/10" : "bg-white/[0.04]"
                  )}
                  style={{ left: `${((i * 4) / STEPS) * 100}%` }}
                />
              ))}
            </div>
            {NOTES.map(([start, len, row, , off], i) => (
              <span
                key={i}
                className={cn(
                  "absolute rounded-[2px]",
                  off ? "bg-red-500/70 ring-1 ring-red-400" : "bg-[#e8a23d]"
                )}
                style={{
                  left: `${(start / STEPS) * 100}%`,
                  width: `calc(${(len / STEPS) * 100}% - 1px)`,
                  top: row * 13 + 2,
                  height: 9,
                  opacity: off ? 1 : start / STEPS < PLAYHEAD ? 1 : 0.4,
                }}
              />
            ))}
          </div>

          {/* Velocity lane */}
          <div className="relative h-9 border-t border-graphite-800">
            {NOTES.map(([start, , , vel, off], i) => (
              <span
                key={i}
                className={cn("absolute bottom-0 w-[3px] rounded-t-[1px]", off ? "bg-red-500/70" : "bg-amber-500/70")}
                style={{ left: `${(start / STEPS) * 100}%`, height: `${vel * 100}%` }}
              />
            ))}
            <span className="absolute left-1.5 top-1 font-mono text-[9px] text-text-subtle">VEL</span>
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-amber-400 shadow-[0_0_10px_rgba(232,162,61,0.7)]"
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