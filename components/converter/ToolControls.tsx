"use client";

/**
 * components/converter/ToolControls.tsx
 *
 * The control vocabulary every tool form draws from.
 *
 * About twenty forms hand-roll the same four shapes: a labelled field with a
 * readout on the right, a grid of selectable option cards, a full-width toggle
 * row, and a small numeric stepper. Twenty implementations of four shapes is
 * why the tools look like twenty products — and it's why fixing them one file
 * at a time would mean writing the same layout twenty times and watching it
 * drift again by spring.
 *
 * Same move as JobFormKit: the shapes live here, the tool keeps only what makes
 * it that tool.
 *
 * WHAT ISN'T HERE, AND WHY
 *
 *  · <Button> — actions are the shell's job. These are inputs.
 *  · ThresholdMeter — already shared, already an instrument rather than a
 *    generic control. It sits beside this kit, not inside it.
 *  · Anything with a canvas. TrimForm's waveform is a tool, not a control.
 *
 * ONE BEHAVIOUR THIS FIXES ON ARRIVAL: a radiogroup is ONE tab stop with arrows
 * between the options — that's what the role promises and what assistive tech
 * tells the user to expect. StemsForm implemented that by hand; ConvertForm
 * declared the same role and gave every option its own tab stop, so the format
 * picker was nine tab stops with no arrow keys, which is worse than using no
 * role at all. OptionCards has the roving behaviour built in, so a form cannot
 * get it wrong by omission.
 */

import { useEffect, useState, useRef, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ */
/* useMediaDuration — the client-side half of a duration cap           */
/* ------------------------------------------------------------------ */

/**
 * Reads a file's duration in the browser, without uploading a byte.
 *
 * WHY THIS EXISTS: a server-side duration cap cannot fail fast. The check
 * needs ffprobe on a file already written to disk, so the rejection lands
 * AFTER the whole transfer — someone drops a 40-minute file, waits out the
 * upload, and gets a 400 at the end. The browser already knows the answer
 * before the first byte leaves.
 *
 * Returns null when the container can't be decoded, and null means DON'T
 * BLOCK: a format the browser refuses may still be perfectly fine for
 * ffprobe, and refusing a valid file to save a round trip is the wrong
 * trade. Advisory gate, authoritative server.
 *
 * DUPLICATES `readMediaDuration` in lib/api/transcription.ts, deliberately for
 * now: importing that module here would pull the whole transcription API
 * surface into every tool bundle that wants a five-line probe. Worth lifting
 * both into lib/utils/ the next time either is touched.
 */
export function useMediaDuration(file: File | null): number | null {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }

    let settled = false;
    const el = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let timer: ReturnType<typeof setTimeout>;

    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      setDuration(value);
    };

    el.preload = "metadata";
    el.onloadedmetadata = () =>
      done(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null);
    el.onerror = () => done(null);
    // Some containers fire neither event. This gate is an optimisation, not a
    // requirement — it must never leave the submit button waiting forever.
    timer = setTimeout(() => done(null), 8_000);
    el.src = url;

    return () => {
      el.onloadedmetadata = null;
      el.onerror = null;
      done(null);
    };
  }, [file]);

  return duration;
}

/* ------------------------------------------------------------------ */
/* Field — label left, live readout right                              */
/* ------------------------------------------------------------------ */

/**
 * The header every control in these forms already had, in slightly different
 * proportions each time: "Convert to" with WAV → MP3 on the right, "Clip range"
 * with 0:04.0 – 1:12.3, "Quality" with nothing.
 *
 * `meta` is for a value the user is watching change. It's mono because it's a
 * readout, and it's on the right because that's where every other number in
 * this product sits.
 */
export function ControlField({
  label,
  meta,
  hint,
  htmlFor,
  as = "label",
  children,
}: {
  label: string;
  /** Live readout, right-aligned. Mono, because it's a number. */
  meta?: ReactNode;
  /** One quiet line under the control. */
  hint?: ReactNode;
  htmlFor?: string;
  /**
   * "label" for a single input; "fieldset" when the control is a GROUP — a
   * radiogroup, a pair of sliders — where a <label> points at nothing and a
   * <legend> is the element that names it.
   */
  as?: "label" | "fieldset";
  children: ReactNode;
}) {
  const header = (
    <>
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {meta && <span className="shrink-0 font-mono text-[11px] text-text-subtle">{meta}</span>}
    </>
  );

  const body = (
    <>
      {children}
      {hint && <div className="text-[11px] leading-relaxed text-text-subtle">{hint}</div>}
    </>
  );

  /**
   * The <legend> is the fieldset's FIRST CHILD, not a heading nested in a
   * layout div. A legend anywhere else is not the group's caption — the browser
   * renders it as an ordinary block and assistive tech never associates it, so
   * the group announces as unnamed. It carries the flex row itself instead,
   * which is legal (legend takes flow content) and keeps the association.
   */
  if (as === "fieldset") {
    return (
      <fieldset className="space-y-2.5">
        <legend className="mb-2.5 flex w-full items-baseline justify-between gap-3">
          {header}
        </legend>
        {body}
      </fieldset>
    );
  }

  return (
    <div className="space-y-2.5">
      <label className="flex items-baseline justify-between gap-3" htmlFor={htmlFor}>
        {header}
      </label>
      {body}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hint — the Info/AlertTriangle line these forms keep re-inventing     */
/* ------------------------------------------------------------------ */

export function Hint({
  tone = "muted",
  title,
  children,
}: {
  tone?: "muted" | "warn" | "bad";
  /** Bolder first line, for a note that's really a small error panel. */
  title?: string;
  children: ReactNode;
}) {
  const Icon = tone === "muted" ? Info : AlertTriangle;
  return (
    <div
      role={tone === "bad" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 text-[11px] leading-relaxed",
        tone === "muted" && "text-text-subtle",
        tone === "warn" &&
          "rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-amber-200",
        tone === "bad" && "rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3 text-red-200"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-3 w-3 shrink-0",
          tone === "warn" && "h-3.5 w-3.5 text-amber-400",
          tone === "bad" && "h-3.5 w-3.5 text-red-400"
        )}
        aria-hidden
      />
      <span className="min-w-0">
        {title && <span className="block text-sm font-medium text-text-primary">{title}</span>}
        <span className={cn(title && "mt-0.5 block text-xs text-text-muted")}>{children}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OptionCards — the radiogroup both pickers wanted to be               */
/* ------------------------------------------------------------------ */

export interface CardOption<T extends string> {
  value: T;
  /** The name. Mono uppercase for a format, sentence case for a mode. */
  title: string;
  /** Rendered inside the title, after the text — an icon, a FreeTierBadge. */
  titleAfter?: ReactNode;
  /** Rendered before the title — a Sparkles, usually. */
  titleBefore?: ReactNode;
  /** Top-right of the card: "Lossless", "1–2 min". */
  meta?: string;
  /**
   * "good" tints the meta teal instead of amber/subtle — for a value that is
   * a genuine advantage rather than a neutral spec. A stream copy that
   * finishes instantly is one; a bitrate is not.
   */
  metaTone?: "default" | "good";
  /** One line under the title. */
  detail?: string;
  /** A second, quieter line — a rate limit, a caveat. Mono. */
  footnote?: string;
  disabled?: boolean;
}

/**
 * A grid of selectable cards behaving as one radiogroup: a single tab stop,
 * arrows to move, Home/End to jump.
 *
 * `mono` typesets the title as a format code rather than a label — the
 * difference between WAV and "Studio Quality".
 */
export function OptionCards<T extends string>({
  options,
  value,
  onChange,
  label,
  columns = 2,
  disabled = false,
  mono = false,
}: {
  options: ReadonlyArray<CardOption<T>>;
  value: T | "";
  onChange: (next: T) => void;
  /** Names the group for assistive tech. Required — an unnamed radiogroup is
   *  announced as "group" and nothing else. */
  label: string;
  /** 4 also halves on mobile (2 up, 4 across) — a four-wide row of cards is
   *  unreadable on a phone, and a four-tall stack wastes the screen. */
  columns?: 1 | 2 | 3 | 4;
  disabled?: boolean;
  mono?: boolean;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectable = options.filter((o) => !o.disabled);
  const currentIndex = options.findIndex((o) => o.value === value);

  function move(delta: number | "first" | "last") {
    if (selectable.length === 0) return;
    const order = selectable.map((o) => options.indexOf(o));
    const here = order.indexOf(currentIndex);
    let next: number;
    if (delta === "first") next = order[0];
    else if (delta === "last") next = order[order.length - 1];
    else {
      const from = here < 0 ? (delta > 0 ? -1 : 0) : here;
      next = order[(from + delta + order.length) % order.length];
    }
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        move("first");
        break;
      case "End":
        e.preventDefault();
        move("last");
        break;
    }
  }

  /* With nothing selected the group still needs exactly one tab stop, or it
     drops out of the tab order entirely and the control becomes unreachable by
     keyboard. The first enabled option takes it. */
  const tabStopIndex = currentIndex >= 0 ? currentIndex : options.findIndex((o) => !o.disabled);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "grid gap-2",
        columns === 4
          ? "grid-cols-2 sm:grid-cols-4"
          : columns === 3
            ? "sm:grid-cols-3"
            : columns === 2
              ? "sm:grid-cols-2"
              : ""
      )}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        const isDisabled = disabled || option.disabled;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === tabStopIndex ? 0 : -1}
            disabled={isDisabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border p-3.5 text-left transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? "border-amber-500/60 bg-amber-500/[0.07]"
                : "border-graphite-700 bg-graphite-850 hover:border-graphite-600 hover:bg-graphite-800/60"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1.5 font-semibold",
                  mono ? "font-mono text-sm uppercase tracking-tight" : "text-sm",
                  selected ? "text-amber-400" : "text-text-primary"
                )}
              >
                {option.titleBefore}
                <span className="truncate">{option.title}</span>
                {option.titleAfter}
              </span>
              {option.meta && (
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] uppercase tracking-wider",
                    option.metaTone === "good"
                      ? selected
                        ? "text-teal-400"
                        : "text-teal-500/70"
                      : selected
                        ? "text-amber-500/80"
                        : "text-text-subtle"
                  )}
                >
                  {option.meta}
                </span>
              )}
            </div>
            {option.detail && (
              <p className="mt-1 text-[11px] leading-snug text-text-muted">{option.detail}</p>
            )}
            {option.footnote && (
              <p className="mt-1 font-mono text-[10px] text-text-subtle">{option.footnote}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented — the compact pill row                                     */
/* ------------------------------------------------------------------ */

/**
 * A single row of small pills behaving as one radiogroup.
 *
 * OptionCards is for a choice you READ — a format with a quality note, a
 * quality tier with a time estimate. This is for a choice you already know the
 * shape of: -1 oct / -5th / Normal, 50% / 75% / 100%, 16-bit / 24-bit. There is
 * nothing to explain, so a card's worth of padding is wasted height.
 *
 * Same roving-tabindex behaviour as OptionCards, for the same reason: three
 * forms had hand-rolled this row and none of them made it one tab stop.
 *
 * `icon` grows a pill into a proper two-item choice — the vocals/instrumental
 * switch on the separation forms, where the glyph is doing as much work as the
 * word. Without one the row stays compact, which is what a preset needs.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  mono = false,
}: {
  options: ReadonlyArray<{ value: T; label: string; ariaLabel?: string; icon?: ReactNode }>;
  value: T;
  onChange: (next: T) => void;
  /** Names the group. Required — an unnamed radiogroup announces as "group". */
  label: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = options.findIndex((o) => o.value === value);

  function move(to: number | "first" | "last") {
    if (options.length === 0) return;
    const next =
      to === "first"
        ? 0
        : to === "last"
          ? options.length - 1
          : (((current < 0 ? 0 : current) + to + options.length) % options.length);
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        move("first");
        break;
      case "End":
        e.preventDefault();
        move("last");
        break;
    }
  }

  const tabStop = current >= 0 ? current : 0;

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1.5">
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
              option.icon && "flex items-center justify-center gap-2 py-2.5 text-sm capitalize",
              mono && "font-mono",
              "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
              "disabled:pointer-events-none disabled:opacity-40",
              selected
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-graphite-600 hover:text-text-primary"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ToggleRow — the notify switch, and everything shaped like it         */
/* ------------------------------------------------------------------ */

/**
 * Full-width on/off row: icon, a line of text that states the CURRENT state,
 * amber when on.
 *
 * Not a <Button>: the label wraps to two lines when a browser has blocked the
 * permission behind it, and Button is a fixed-height, centre-aligned control —
 * fitting this would mean overriding its height, alignment and padding, at
 * which point nothing of it is left.
 *
 * `pressed` is passed straight to aria-pressed. Without it a screen reader
 * announces the same thing whether the toggle is on or off, which is the bug
 * this shape shipped with in two separate forms.
 */
export function ToggleRow({
  pressed,
  onToggle,
  disabled = false,
  iconOn,
  iconOff,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  iconOn: ReactNode;
  iconOff: ReactNode;
  /** State-dependent copy. Say what IS true, not what pressing would do. */
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={pressed}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
        "disabled:pointer-events-none disabled:opacity-40",
        pressed
          ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
          : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-graphite-600 hover:text-text-primary"
      )}
    >
      <span className="shrink-0" aria-hidden>
        {pressed ? iconOn : iconOff}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper — number input with its own increment segments               */
/* ------------------------------------------------------------------ */

/**
 * A compound control: the field and its two arrows share one border, so they
 * read as one object rather than three.
 *
 * NOT <Button> for the arrows, deliberately: they're 14px segments sharing a
 * border with the input. Button's smallest size is 32px tall, so fitting them
 * would take enough overrides that nothing of the component survives.
 */
export function Stepper({
  label,
  value,
  step = 0.1,
  bigStep = 1,
  precision = 1,
  unit,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  /** Typed/arrow-key granularity. */
  step?: number;
  /** What the up/down segments move by. */
  bigStep?: number;
  /** Decimal places shown in the field. */
  precision?: number;
  /** Suffix inside the field, e.g. "dB", "×". */
  unit?: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const rounded = Number(value.toFixed(precision));

  /**
   * WHY THIS FIELD KEEPS A DRAFT.
   *
   * Callers clamp — that's the contract, and it's what stops the arrows and the
   * field disagreeing about bounds. But a clamped CONTROLLED input cannot be
   * typed into: to reach 125 you must first type "1", which clamps to the
   * minimum and rewrites the box under the cursor before you press the second
   * key. The field ends up unusable by anything except the arrows.
   *
   * So while the user is typing, the box shows exactly what they typed. Each
   * keystroke still commits (the preview stays live), and on blur the draft is
   * dropped so the field snaps to whatever the clamp actually accepted.
   */
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: number) => {
    setDraft(null);
    onChange(next);
  };

  return (
    <label className="flex items-center gap-1.5 text-xs text-text-muted">
      {label}
      <span className="flex items-center overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850 focus-within:border-amber-500/50">
        <input
          type="number"
          step={step}
          value={draft ?? String(rounded)}
          disabled={disabled}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const next = Number(raw);
            // An empty box is mid-edit, not zero — committing 0 here is what
            // snapped the value to the minimum on the first keystroke.
            if (raw.trim() !== "" && Number.isFinite(next)) onChange(next);
          }}
          className={cn(
            "w-16 bg-transparent px-2 py-1 text-right font-mono text-text-primary",
            "[appearance:textfield] focus:outline-none disabled:opacity-40",
            "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          )}
        />
        {unit && <span className="pr-2 font-mono text-[10px] text-text-subtle">{unit}</span>}
        <span className="flex flex-col border-l border-graphite-700">
          <StepSegment
            label={`Increase ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => commit(value + bigStep)}
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </StepSegment>
          <StepSegment
            label={`Decrease ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => commit(value - bigStep)}
            divided
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </StepSegment>
        </span>
      </span>
    </label>
  );
}

function StepSegment({
  label,
  disabled,
  onClick,
  divided = false,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors",
        "hover:bg-graphite-800 hover:text-amber-400",
        "outline-none focus-visible:bg-graphite-800 focus-visible:text-amber-400",
        "disabled:pointer-events-none disabled:opacity-40",
        divided && "border-t border-graphite-700"
      )}
    >
      {children}
    </button>
  );
}