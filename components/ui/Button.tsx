import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * THE GLOW IS GONE (2026-08-17).
 *
 * `shadow-[0_0_24px_-4px_rgba(232,162,61,0.5)]` on hover was the single
 * thing making this look unserious: a coloured halo bleeding out from a
 * button is a gaming/neon convention, and no interface people associate
 * with professional tools uses one.
 *
 * What replaces it is what actually makes a filled button feel solid: a
 * 1px inset highlight along the top edge, so the surface reads as lit
 * from above rather than emitting light.
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
  outline: cn(
    "border border-graphite-700 bg-graphite-900/40 text-text-primary",
    "hover:border-graphite-600 hover:bg-graphite-900",
    "active:bg-graphite-850"
  ),
  ghost: "text-text-muted hover:bg-graphite-900 hover:text-text-primary active:bg-graphite-850",
  danger: cn(
    "bg-red-600 text-white",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
    "hover:bg-red-500",
    "active:bg-red-700"
  ),
};

/**
 * Icons size themselves from the button's size, so call sites don't have
 * to remember that lg takes h-5 and md takes h-4 — and can't drift when
 * someone forgets. Explicit sizing on a child icon is overridden by this
 * (the descendant selector outranks a plain utility class), which is the
 * point: one source of truth per size.
 *
 * The upshot for existing call sites: `<Icon className="h-5 w-5" />`
 * inside a Button can just be `<Icon />`. Leaving the classes in is
 * harmless, they simply stop having an effect.
 */
const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-10 gap-2 px-4 text-sm [&_svg]:h-4 [&_svg]:w-4",
  lg: "h-12 gap-2.5 px-6 text-base [&_svg]:h-5 [&_svg]:w-5",
  // Square, for icon-only buttons. Always pass an aria-label with this.
  icon: "h-10 w-10 [&_svg]:h-4 [&_svg]:w-4",
};

const spinnerSize: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-[18px] w-[18px]",
  icon: "h-4 w-4",
};

/**
 * Exported so a <Link> or <a> can wear the same clothes without being
 * wrapped in a <button>, which is invalid markup and loses middle-click,
 * open-in-new-tab and the status-bar URL preview:
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
    // Explicit property list, not transition-all: transition-all also
    // animates width and height, so a button that changes label or size
    // visibly stretches into its new dimensions.
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    // A real press state. Its absence is most of why a button feels cheap
    // - the pointer goes down and nothing acknowledges it.
    "active:translate-y-px motion-reduce:active:translate-y-0",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950",
    // pointer-events-none rather than just opacity: a natively disabled
    // button still matches :hover, so without this a dimmed control still
    // lights up under the cursor.
    "disabled:pointer-events-none disabled:opacity-40",
    // Same treatment for the loading state, which uses aria-disabled
    // rather than disabled - see the note in the component.
    "aria-disabled:cursor-default aria-disabled:hover:bg-inherit",
    variantStyles[variant],
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
      disabled = false,
      children,
      onClick,
      // Defaulting to "button" rather than inheriting the HTML default of
      // "submit". A button dropped inside a <form> for an unrelated
      // purpose silently submitting it is a bug that's hard to see and
      // easy to ship.
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
         * A disabled element can't hold focus, so the browser drops focus
         * to <body> the instant a job starts - a keyboard user tabs to
         * Submit, presses Enter, and their place in the page vanishes.
         * aria-disabled keeps the button focusable and correctly
         * announced ("dimmed"/"unavailable"), and the guard below stops
         * the activation. Enter and Space both fire a click event on a
         * button, so one guard covers pointer and keyboard alike.
         *
         * `disabled` is still used for genuinely unavailable actions,
         * where losing focus is the correct behaviour.
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
        {/* The label keeps its space while loading and the spinner sits on
            top of it. Rendering the spinner *before* the children instead
            makes the button widen and the label jump sideways at the
            exact moment the user is waiting to see whether the click
            registered. */}
        <span className={cn("inline-flex items-center gap-[inherit]", loading && "invisible")}>
          {children}
        </span>

        {loading && (
          <span className="absolute inset-0 inline-flex items-center justify-center">
            <Loader2 className={cn("animate-spin", spinnerSize[size])} />
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";