"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";

const SNIPPET = `<iframe src="${SITE_URL}/embed/key-finder"
  width="100%" height="330" style="border:none;max-width:520px"
  title="Free key and BPM finder by AudioForges"
  loading="lazy"></iframe>`;

export function EmbedSnippet() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
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

      <div className="mt-4 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
        <pre className="overflow-x-auto px-4 py-3.5 text-[13px] leading-relaxed text-text-primary">
          <code>{SNIPPET}</code>
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