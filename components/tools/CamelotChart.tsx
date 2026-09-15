"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CamelotWheel } from "@/components/tools/CamelotWheel";
import { CAMELOT_KEYS, camelotMoves } from "@/lib/data/camelot";

export function CamelotChart() {
  const [code, setCode] = useState("8A");
  const moves = camelotMoves(code);
  const current = CAMELOT_KEYS.find((k) => k.code === code);

  return (
    <div className="space-y-5">
      <CamelotWheel highlight={code} onPick={setCode} />

      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-5" aria-live="polite">
        <p className="text-sm text-text-muted">Playing</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
          <span className="text-amber-400">{code}</span> {current?.key}
        </p>
        <ul className="mt-4 divide-y divide-graphite-800">
          {moves.map((m) => (
            <li key={m.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block text-text-primary">{m.label}</span>
                <span className="block text-xs text-text-subtle">{m.note}</span>
              </span>
              <button
                type="button"
                onClick={() => setCode(m.code)}
                className="shrink-0 rounded-md px-2 py-1 text-right outline-none transition-colors hover:bg-graphite-850 focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span className="block font-semibold text-amber-400">{m.code}</span>
                <span className="block text-xs text-text-muted">{m.key}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-subtle">Tap any key on the wheel, or a code above, to move around.</p>
      </div>
    </div>
  );
}

export function EmbedSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-graphite-950/70 p-3 font-mono text-xs leading-relaxed text-text-body">
        {snippet}
      </pre>
      <Button size="sm" variant="outline" onClick={copy} className="mt-3">
        {copied ? <Check className="text-teal-400" /> : <Copy />}
        {copied ? "Copied" : "Copy HTML"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}