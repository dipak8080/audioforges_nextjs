import Link from "next/link";
import { Mic, Link2, Film } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Real navigation, not client-side state.
 *
 * The three transcription pages share one form component, which makes it
 * tempting to render all three modes on a single route and toggle between
 * them. That would be a duplicate-content problem: three URLs serving
 * identical HTML, with Google picking one and dropping the other two.
 *
 * So each mode is its own route with its own copy, and these are <Link>s
 * between them. The tab bar exists to catch the "wrong door" case — the
 * person who lands on /audio-to-text from search and actually has a
 * YouTube link — without merging the routes.
 *
 * A server component: `active` is passed in rather than read from
 * usePathname, so this ships no client JavaScript.
 */

const MODES = [
  { href: "/audio-to-text", label: "Audio file", icon: Mic },
  { href: "/youtube-to-text", label: "YouTube link", icon: Link2 },
  { href: "/video-to-text", label: "Video file", icon: Film },
] as const;

export type TranscriptionTabHref = (typeof MODES)[number]["href"];

export function TranscriptionModeTabs({ active }: { active: TranscriptionTabHref }) {
  return (
    <nav aria-label="Transcription input type" className="flex flex-wrap gap-2">
      {MODES.map((mode) => {
        const isActive = mode.href === active;
        const Icon = mode.icon;

        return (
          <Link
            key={mode.href}
            href={mode.href}
            // prefetch disabled sitewide on bulk tool links — four edge
            // requests per route adds up fast on a page that renders this
            // on every visit.
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
              isActive
                ? "border-amber-500/40 bg-amber-500/[0.07] text-amber-400"
                : "border-graphite-800 bg-graphite-900 text-text-muted hover:border-graphite-700 hover:text-text-primary"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {mode.label}
          </Link>
        );
      })}
    </nav>
  );
}