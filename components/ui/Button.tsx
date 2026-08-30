import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon-sm" | "icon" | "icon-lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Announced while `loading`. The label is hidden behind the spinner, so
   *  without this a screen reader hears an unnamed busy button. */
  loadingLabel?: string;
}

/**
 * THE GLOW IS GONE (2026-08-17).
 *
 * `shadow-[0_0_24px_-4px_rgba(232,162,61,0.5)]` on hover was the single thing
 * making this look unserious: a coloured halo bleeding out from a button is a
 * gaming/neon convention, and no interface people associate with professional
 * tools uses one.
 *
 * What replaces it is what actually makes a filled button feel solid: a 1px
 * inset highlight along the top edge, so the surface reads as lit from above
 * rather than emitting light.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE NEUTRAL VARIANTS HAD NO HOVER ON THE SURFACE THEY SIT ON. `outline`
 *    and `ghost` both hovered to graphite-900 — which is the background of
 *    every card on the site, including the one holding "Process another file".
 *    The most-used secondary action on every tool page had a hover state that
 *    was, by construction, invisible. Both now move one step lighter than the
 *    card they live on.
 *
 * 2. `aria-disabled:hover:bg-inherit` TURNED A LOADING PRIMARY BUTTON GREY.
 *    `bg-inherit` takes the PARENT's background, not the button's resting
 *    colour, so hovering a submitting amber button repainted it in the card's
 *    graphite. Replaced with a cursor change, which is what the state actually
 *    warrants — the spinner already says it's busy.
 *
 * 3. THE SPINNER SIZE MAP WAS DEAD CODE. `sizeStyles` sets `[&_svg]:h-4` and
 *    friends, and a descendant selector outranks the plain `h-4` the map put on
 *    the spinner — so every spinner was already sized by its button. The map's
 *    one real difference (18px on `lg`) never applied. Removed rather than
 *    forced through with `!`, since the sizes it fought were correct.
 *
 * 4. THE FOCUS RING WAS AMBER ON THE DANGER VARIANT. Now the ring follows the
 *    variant, so a destructive control doesn't focus in the accent colour of
 *    the primary one.
 *
 * 5. THE RING OFFSET WAS HARDCODED TO graphite-950. On a graphite-900 card that
 *    drew a subtly darker halo around every focused button. Transparent lets
 *    the gap show whatever surface is actually behind it.
 *
 * 6. TWO MORE ICON SIZES. `size="icon"` was the only square, so anything that
 *    needed a smaller one overrode `h-8 w-8` at the call site —
 *    MultiOutputToolForm's per-stem download does exactly that. A size that
 *    call sites have to correct is a missing size.
 */
const variantStyles: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-amber-500 text-graphite-950",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
    "hover:bg-amber-400",
    "active:bg-amber-600"
  ),
  secondary: cn(
    "bg-graphite-800 text-text-primary",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    "hover:bg-graphite-700",
    "active:bg-graphite-800"
  ),
  // Hover moves UP from the card, not down into it. graphite-900 is the card
  // colour almost everywhere these sit, so hovering to it was a no-op.
  outline: cn(
    "border border-graphite-700 bg-transparent text-text-primary",
    "hover:border-graphite-600 hover:bg-graphite-850",
    "active:bg-graphite-800"
  ),
  ghost: "text-text-muted hover:bg-graphite-850 hover:text-text-primary active:bg-graphite-800",
  danger: cn(
    "bg-red-600 text-white",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
    "hover:bg-red-500",
    "active:bg-red-700"
  ),
};

/** The ring belongs to the action, not to the brand. A destructive button that
 *  focuses in amber looks like it's about to do something friendly. */
const ringStyles: Record<ButtonVariant, string> = {
  primary: "focus-visible:ring-amber-500/50",
  secondary: "focus-visible:ring-amber-500/50",
  outline: "focus-visible:ring-amber-500/50",
  ghost: "focus-visible:ring-amber-500/50",
  danger: "focus-visible:ring-red-500/60",
};

/**
 * Icons size themselves from the button's size, so call sites don't have to
 * remember that lg takes h-5 and md takes h-4 — and can't drift when someone
 * forgets. Explicit sizing on a child icon is overridden by this (the
 * descendant selector outranks a plain utility class), which is the point: one
 * source of truth per size. It's also what sizes the loading spinner.
 *
 * The upshot for existing call sites: `<Icon className="h-5 w-5" />` inside a
 * Button can just be `<Icon />`. Leaving the classes in is harmless, they simply
 * stop having an effect.
 */
const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-10 gap-2 px-4 text-sm [&_svg]:h-4 [&_svg]:w-4",
  lg: "h-12 gap-2.5 px-6 text-base [&_svg]:h-5 [&_svg]:w-5",
  // Squares, for icon-only buttons. Always pass an aria-label with these.
  "icon-sm": "h-8 w-8 [&_svg]:h-3.5 [&_svg]:w-3.5",
  icon: "h-10 w-10 [&_svg]:h-4 [&_svg]:w-4",
  "icon-lg": "h-12 w-12 [&_svg]:h-5 [&_svg]:w-5",
};

/**
 * Exported so a <Link> or <a> can wear the same clothes without being wrapped in
 * a <button>, which is invalid markup and loses middle-click, open-in-new-tab
 * and the status-bar URL preview:
 *
 *   <Link href="/tools" className={buttonStyles({ variant: "outline" })}>
 *   <a href={downloadUrl} download className={buttonStyles({ size: "lg" })}>
 *
 * Every hand-rolled amber button on the site should be one of these.
 */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "relative inline-flex cursor-pointer select-none items-center justify-center rounded-lg font-medium",
    "[&_svg]:shrink-0",
    // Explicit property list, not transition-all: transition-all also animates
    // width and height, so a button that changes label or size visibly stretches
    // into its new dimensions.
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    // A real press state. Its absence is most of why a button feels cheap — the
    // pointer goes down and nothing acknowledges it.
    "active:translate-y-px motion-reduce:active:translate-y-0",
    // Offset is transparent rather than a fixed colour: these sit on graphite
    // 850, 900 and 950 depending on the surface, and a hardcoded offset drew a
    // darker halo on every card that wasn't the page background.
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    // pointer-events-none rather than just opacity: a natively disabled button
    // still matches :hover, so without this a dimmed control still lights up
    // under the cursor.
    //
    // 60 rather than 40: on the neutral variants the fill is already a
    // low-contrast grey, so 40% left the label barely legible against a dark
    // card — it read as broken rather than unavailable. The variant change from
    // amber to grey is what communicates "not yet"; the opacity only needs to
    // soften it, not erase it.
    "disabled:pointer-events-none disabled:opacity-60",
    // The loading state uses aria-disabled rather than disabled — see the note
    // in the component. It keeps its own colour: the spinner already says it's
    // busy, and repainting the fill on hover (which `bg-inherit` used to do)
    // turned a submitting amber button grey mid-click.
    "aria-disabled:cursor-progress",
    variantStyles[variant],
    ringStyles[variant],
    sizeStyles[size],
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel = "Working",
      disabled = false,
      children,
      onClick,
      // Defaulting to "button" rather than inheriting the HTML default of
      // "submit". A button dropped inside a <form> for an unrelated purpose
      // silently submitting it is a bug that's hard to see and easy to ship.
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        /**
         * LOADING DOES NOT SET `disabled` (2026-08-17).
         *
         * A disabled element can't hold focus, so the browser drops focus to
         * <body> the instant a job starts — a keyboard user tabs to Submit,
         * presses Enter, and their place in the page vanishes. aria-disabled
         * keeps the button focusable and correctly announced
         * ("dimmed"/"unavailable"), and the guard below stops the activation.
         * Enter and Space both fire a click event on a button, so one guard
         * covers pointer and keyboard alike.
         *
         * `disabled` is still used for genuinely unavailable actions, where
         * losing focus is the correct behaviour.
         */
        disabled={disabled}
        aria-disabled={loading || undefined}
        aria-busy={loading || undefined}
        onClick={(e) => {
          if (loading) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onClick?.(e);
        }}
        className={buttonStyles({ variant, size, className })}
        {...props}
      >
        {/* The label keeps its space while loading and the spinner sits on top of
            it. Rendering the spinner *before* the children instead makes the
            button widen and the label jump sideways at the exact moment the user
            is waiting to see whether the click registered. */}
        <span className={cn("inline-flex items-center gap-[inherit]", loading && "invisible")}>
          {children}
        </span>

        {loading && (
          <span className="absolute inset-0 inline-flex items-center justify-center">
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            {/* The visible label is hidden behind this, so the button would
                otherwise be announced with no name at all while it works. */}
            <span className="sr-only">{loadingLabel}</span>
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";