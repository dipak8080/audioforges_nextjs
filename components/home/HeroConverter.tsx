"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * The homepage's primary action, in place of a button that only promises
 * one. A visitor who arrived from "youtube to wav" already has the link
 * on their clipboard; making them click through to a second page before
 * they can paste it is a step that buys nothing.
 *
 * REQUIRES ONE CHANGE ON /youtube-to-wav: read `url` off searchParams and
 * prefill the form with it. Without that this is just a slower link.
 * Roughly:
 *
 *   const params = useSearchParams();
 *   const initialUrl = params.get("url") ?? "";
 *
 * Ship the tool-page change first, then this.
 */
export function HeroConverter() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();

    if (!value) {
      setError("Paste a link to start.");
      return;
    }
    // Deliberately loose. The tool page does the real validation and knows
    // which hosts it supports; this only catches obvious non-links so the
    // visitor isn't bounced to another page to be told the same thing.
    if (!/^(https?:\/\/)?\S+\.\S+/.test(value) || /\s/.test(value)) {
      setError("That doesn't look like a link. Paste the full URL.");
      return;
    }

    const normalized = /^https?:\/\//.test(value) ? value : `https://${value}`;
    setError(null);
    router.push(`/youtube-to-wav?url=${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            aria-invalid={Boolean(error)}
            className={cn(
              "h-12 w-full rounded-lg border bg-graphite-900 pl-10 pr-3 text-sm text-text-primary transition-colors",
              "placeholder:text-text-subtle focus:outline-none focus:ring-2",
              error
                ? "border-red-500/60 focus:ring-red-500/20"
                : "border-graphite-700 focus:border-amber-500/50 focus:ring-amber-500/30"
            )}
          />
        </div>

        {/* size="lg" is h-12, matching the input beside it, so the row
            still lines up. This was hand-rolled amber classes until
            2026-08-17 - the exact drift the Button component exists to
            prevent, and it still carried the old hover-glow styling. */}
        <Button type="submit" size="lg" className="shrink-0">
          Convert
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p
        aria-live="polite"
        className={cn(
          "mt-2 min-h-[1.25rem] text-sm",
          error ? "text-red-400" : "text-text-subtle"
        )}
      >
        {error}
      </p>
    </div>
  );
}