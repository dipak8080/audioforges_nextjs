"use client";

import { useEffect, useState } from "react";

interface ProcessingIndicatorProps {
  label: string;
  expectedRange?: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ProcessingIndicator({ label, expectedRange }: ProcessingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="w-full max-w-xs h-1.5 rounded-full bg-graphite-800 overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-amber-500 animate-indeterminate" />
      </div>
      <p className="text-sm text-text-muted">{label}</p>
      <p className="text-xs font-mono text-text-subtle tabular-nums">
        {formatElapsed(elapsed)} elapsed
        {expectedRange ? ` — usually ${expectedRange}` : ""}
      </p>
    </div>
  );
}