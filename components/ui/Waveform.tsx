interface WaveformProps {
  bars?: number;
}

/**
 * Decoration only. Deliberately NOT a live region: this renders inside the
 * forms' `role="status"` working panel, which already announces the current
 * stage in words — so `role="status" aria-label="Processing"` produced a second
 * announcement saying less, nested inside the first, which isn't valid anyway.
 */
export function Waveform({ bars = 7 }: WaveformProps) {
  return (
    <div className="flex h-8 items-end gap-1" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-amber-500 animate-waveform"
          style={{
            animationDelay: `${i * 0.09}s`,
            // Resting height, seen only under prefers-reduced-motion, where
            // globals.css collapses the animation. Varied so the static state
            // reads as a waveform rather than a row of identical ticks.
            height: `${30 + ((i * 37) % 45)}%`,
          }}
        />
      ))}
    </div>
  );
}