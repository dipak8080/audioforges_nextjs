interface WaveformProps {
  bars?: number;
}

export function Waveform({ bars = 7 }: WaveformProps) {
  return (
    <div className="flex items-end gap-1 h-8" role="status" aria-label="Processing">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-amber-500 animate-waveform"
          style={{ animationDelay: `${i * 0.09}s`, height: "40%" }}
        />
      ))}
    </div>
  );
}