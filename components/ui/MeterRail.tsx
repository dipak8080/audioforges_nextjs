import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The signature element of a tool page: a ruler of tick marks with an amber
 * segment that settles into place once on load, like a meter needle coming
 * to rest. It sits directly above the tool so the form reads as the front
 * of an instrument rather than a web form.
 *
 * Why a ruler and not a waveform: every tool on the site works on a
 * timeline — trim, fade, split, tempo, silence — so ticks are the honest
 * shape of what the site does. A decorative waveform would be a picture of
 * audio; the ruler is the control surface.
 *
 * Engineering constraints, all deliberate:
 *   - Server component. No client JS, nothing to hydrate.
 *   - Fixed 16px height, so it can't cause layout shift.
 *   - Ticks are SVG patterns, so the rail is one rect at any width — the
 *     DOM stays tiny on a page that already renders 12 FAQs.
 *   - The only motion is one CSS transform on the amber rect. It runs
 *     once. The global prefers-reduced-motion rule zeroes it.
 *   - Pattern ids come from useId so two rails on one page don't collide.
 *
 * `level` is the resting position of the amber segment as a 0-1 fraction.
 * 0.28 reads as "signal present, headroom to spare". Don't push it past
 * 0.8; a pinned meter means clipping and people who mix will read it that
 * way.
 */
export function MeterRail({
  level = 0.28,
  readout,
  className,
}: {
  level?: number;
  /** Optional mono label at the right end. Keep it to one or two words. */
  readout?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const minor = `${id}-minor`;
  const major = `${id}-major`;
  const clamped = Math.min(0.8, Math.max(0.05, level));

  return (
    <div className={cn("flex items-end gap-4", className)} aria-hidden="true">
      <svg
        className="h-4 w-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Minor tick every 6px, major every 30px. Drawn in currentColor so
              the same two patterns serve both the grey base and the amber
              overlay — the overlay just sets a different colour. */}
          <pattern id={minor} width="6" height="16" patternUnits="userSpaceOnUse">
            <rect x="0" y="9" width="1" height="7" fill="currentColor" />
          </pattern>
          <pattern id={major} width="30" height="16" patternUnits="userSpaceOnUse">
            <rect x="0" y="2" width="1" height="14" fill="currentColor" />
          </pattern>
        </defs>

        {/* Base rail */}
        <g className="text-graphite-700">
          <rect width="100%" height="16" fill={`url(#${minor})`} />
          <rect width="100%" height="16" fill={`url(#${major})`} />
        </g>

        {/* Amber segment. Scales from 0 to `level` once via CSS. */}
        <g
          className="animate-rail-settle text-amber-500"
          style={{
            transformOrigin: "left center",
            transform: `scaleX(${clamped})`,
            transformBox: "view-box",
          }}
        >
          <rect width="100%" height="16" fill={`url(#${minor})`} />
          <rect width="100%" height="16" fill={`url(#${major})`} />
        </g>

        {/* Peak marker — a single brighter tick at the resting position. */}
        <rect
          x={`${clamped * 100}%`}
          y="0"
          width="2"
          height="16"
          className="animate-rail-peak fill-amber-300"
        />
      </svg>

      {readout && (
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
          {readout}
        </span>
      )}
    </div>
  );
}