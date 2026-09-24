"use client";

import { OptionCards, type CardOption } from "@/components/converter/ToolControls";
import type { FormatOption, OutputFormat } from "@/lib/types/converter";

/**
 * The format picker on /youtube-to-wav and /youtube-to-mp3.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * IT DECLARED A radiogroup AND BEHAVED LIKE A TOOLBAR. `role="radiogroup"`
 * tells assistive tech: one tab stop, arrows to move between options. This
 * rendered two plain buttons with no tabIndex management and no key handler,
 * so a screen reader announced a control and then found something that behaves
 * nothing like it, and a keyboard user tabbed through every format on the way
 * to Convert. That is worse than declaring no role at all — a wrong promise is
 * harder to work around than a missing one.
 *
 * Fourth file with this exact bug (ConvertForm, ChannelsForm, ResampleForm and
 * this one), which is why the behaviour now lives in OptionCards rather than
 * being written a fifth time. This component is a thin adapter: it maps
 * FormatOption to CardOption and nothing else.
 *
 * IT STAYS A COMPONENT rather than the form calling OptionCards directly. The
 * FormatOption → CardOption mapping is a real decision — which field becomes
 * the card's meta, which becomes its footnote — and it belongs in one place,
 * not repeated at whatever call sites this picks up later.
 *
 * The rendering is now identical to every other picker on the site. It was
 * close before, but not the same: text-base rather than text-sm on the label,
 * `transition-all` rather than `transition-colors`, and a hover border that
 * went to graphite-700/60 — a lighter shade of the border it already had, so
 * hovering an unselected card did almost nothing visible.
 */
interface FormatSelectorProps {
  options: FormatOption[];
  value: OutputFormat;
  onChange: (value: OutputFormat) => void;
  disabled?: boolean;
}

export function FormatSelector({ options, value, onChange, disabled }: FormatSelectorProps) {
  const cards: CardOption<OutputFormat>[] = options.map((option) => ({
    value: option.value,
    title: option.label,
    // "Lossless" / "Compressed" — the thing you compare the two by, so it
    // takes the top-right slot.
    meta: option.quality,
    detail: option.description,
    // "44.1 kHz · 16-bit · ~10 MB/min" — mono, quietest line, because it's
    // the detail you check once you've already chosen.
    footnote: option.spec,
  }));

  return (
    <OptionCards
      label="Output format"
      options={cards}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}