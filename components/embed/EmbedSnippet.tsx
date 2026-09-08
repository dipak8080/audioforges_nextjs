"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";

const WIDGETS = [
  {
    id: "key-finder",
    label: "Key & BPM finder",
    height: 330,
    title: "Free key and BPM finder by AudioForges",
  },
  {
    id: "audio-to-midi",
    label: "Audio to MIDI",
    height: 420,
    title: "Free audio to MIDI converter by AudioForges",
  },
] as const;

function snippetFor(w: (typeof WIDGETS)[number]) {
  return `<iframe src="${SITE_URL}/embed/${w.id}"
  width="100%" height="${w.height}" style="border:none;max-width:520px"
  title="${w.title}"
  loading="lazy"></iframe>`;
}

export function EmbedSnippet() {
  const [active, setActive] = useState<(typeof WIDGETS)[number]>(WIDGETS[0]);
  const [copied, setCopied] = useState(false);
  const snippet = snippetFor(active);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-text-primary">Copy the code</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Paste this anywhere HTML is allowed — a WordPress custom HTML block, a
        Ghost embed card, or straight into a template.
      </p>

      <div className="mt-4 flex gap-2">
        {WIDGETS.map((w) => (
          <button
            key={w.id}
            onClick={() => {
              setActive(w);
              setCopied(false);
            }}
            className={
              active.id === w.id
                ? "rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400"
                : "rounded-lg border border-graphite-800 px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            }
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
        <pre className="overflow-x-auto px-4 py-3.5 text-[13px] leading-relaxed text-text-primary">
          <code>{snippet}</code>
        </pre>
        <div className="flex items-center justify-between border-t border-graphite-800 px-4 py-2.5">
          <span className="text-xs text-text-secondary">
            Adjust height if you want more or less room.
          </span>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </section>
  );
}