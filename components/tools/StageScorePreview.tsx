const NOTES: [number, number][] = [
  [6, 5], [13, 3], [20, 4], [27, 2], [36, 1], [43, 3], [50, 5], [57, 4],
  [66, 2], [73, 0], [80, 1], [87, 3],
];

function Staff({ top, notes }: { top: number; notes: [number, number][] }) {
  return (
    <div className="absolute inset-x-4" style={{ top: `${top}%`, height: "26%" }}>
      {[0, 1, 2, 3, 4].map((l) => (
        <span
          key={l}
          className="absolute inset-x-0 h-px bg-[#2a2722]/70"
          style={{ top: `${l * 25}%` }}
        />
      ))}
      {[0, 30, 60, 100].map((x) => (
        <span key={x} className="absolute inset-y-0 w-px bg-[#2a2722]/70" style={{ left: `${x}%` }} />
      ))}
      {notes.map(([x, step], i) => (
        <span key={i} className="absolute" style={{ left: `${x}%`, top: `${step * 12.5 - 9}%` }}>
          <span className="block h-[7px] w-[10px] -rotate-[20deg] rounded-[50%] bg-[#1b1916]" />
          <span className="absolute -top-[18px] right-0 h-[20px] w-px bg-[#1b1916]" />
        </span>
      ))}
    </div>
  );
}

// Idle stage art for the sheet music tool. Pure CSS, no audio.
export function StageScorePreview({ caption, sub }: { caption: string; sub: string }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 px-5 py-5 sm:px-7" aria-hidden>
      <style>{`@keyframes af-score{0%{transform:translateX(0)}100%{transform:translateX(100%)}}`}</style>
      <div>
        <p className="text-sm font-medium leading-snug text-text-primary">{caption}</p>
        <p className="mt-0.5 font-mono text-[11px] text-text-subtle">{sub}</p>
      </div>
      <div className="relative h-28 overflow-hidden rounded-lg bg-[#f4f1e8] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)] sm:h-32">
        <Staff top={14} notes={NOTES} />
        <Staff top={60} notes={NOTES.map(([x, s]) => [x, (s + 3) % 7] as [number, number])} />
        <span
          className="absolute inset-0 will-change-transform motion-reduce:hidden"
          style={{ animation: "af-score 8s linear infinite" }}
        >
          <span className="absolute inset-y-0 left-0 w-full bg-[#f4f1e8]/70" />
          <span className="absolute inset-y-0 left-0 w-0.5 bg-amber-500 shadow-[0_0_10px_rgba(232,162,61,0.8)]" />
        </span>
      </div>
    </div>
  );
}