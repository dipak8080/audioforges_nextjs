const NOTES = [
  { row: 1, start: 4, len: 9 },
  { row: 3, start: 14, len: 6 },
  { row: 2, start: 21, len: 12 },
  { row: 5, start: 34, len: 5 },
  { row: 4, start: 40, len: 10 },
  { row: 1, start: 51, len: 7 },
  { row: 6, start: 59, len: 14 },
  { row: 3, start: 74, len: 6 },
  { row: 2, start: 81, len: 11 },
  { row: 7, start: 8, len: 22 },
  { row: 8, start: 36, len: 20 },
  { row: 7, start: 62, len: 26 },
];

const ROWS = 9;

// Idle stage art for the transcription tools. Pure CSS, no audio.
export function StageRollPreview({ caption, sub }: { caption: string; sub: string }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 px-5 py-5 sm:px-7" aria-hidden>
      <style>{`@keyframes af-roll{0%{transform:translateX(0)}100%{transform:translateX(100%)}}`}</style>
      <div>
        <p className="text-sm font-medium leading-snug text-text-primary">{caption}</p>
        <p className="mt-0.5 font-mono text-[11px] text-text-subtle">{sub}</p>
      </div>
      <div className="relative h-28 overflow-hidden rounded-lg bg-graphite-950/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)] sm:h-32">
        {Array.from({ length: ROWS }, (_, r) => (
          <span
            key={r}
            className={r % 2 === 0 ? "absolute inset-x-0 bg-white/[0.02]" : "absolute inset-x-0"}
            style={{ top: `${(r / ROWS) * 100}%`, height: `${100 / ROWS}%` }}
          />
        ))}
        {[0.25, 0.5, 0.75].map((x) => (
          <span key={x} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: `${x * 100}%` }} />
        ))}
        {NOTES.map((n, i) => (
          <span
            key={i}
            className="absolute rounded-[2px]"
            style={{
              left: `${n.start}%`,
              width: `${n.len}%`,
              top: `calc(${(n.row / ROWS) * 100}% + 2px)`,
              height: `calc(${100 / ROWS}% - 4px)`,
              backgroundColor: n.row >= 7 ? "#4dd8b8" : "#e8a23d",
            }}
          />
        ))}
        <span
          className="absolute inset-0 will-change-transform motion-reduce:hidden"
          style={{ animation: "af-roll 7s linear infinite" }}
        >
          <span className="absolute inset-y-0 left-0 w-full bg-graphite-950/70" />
          <span className="absolute inset-y-0 left-0 w-px bg-amber-400 shadow-[0_0_10px_rgba(232,162,61,0.7)]" />
        </span>
      </div>
    </div>
  );
}