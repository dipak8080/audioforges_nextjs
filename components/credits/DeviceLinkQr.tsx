"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Smartphone, RefreshCw, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createDeviceLink } from "@/lib/api/credits";
import { ApiError } from "@/lib/api/railway";
import { trackCredits } from "@/lib/analytics";

/**
 * "Use on my phone" — the four-second version of the magic link.
 *
 * THE PROBLEM IT SOLVES
 *
 * Credits follow the browser cookie. Buy on a laptop, open a phone, and the
 * phone sees zero. The email link already fixes this, but it means switching
 * apps, finding the mail, and waiting on delivery. Scanning a QR off the screen
 * with the phone camera takes about four seconds and involves no typing and no
 * inbox.
 *
 * THE SECURITY POSTURE, STATED PLAINLY
 *
 * The rendered QR encodes a LIVE one-use sign-in credential. Anyone who
 * photographs the screen while it is visible can claim the account. So:
 *
 *  - it is generated on demand, never on page load
 *  - it is never auto-copied to the clipboard and never shown as text
 *  - the screen says what it is, so nobody presents it on a stream or a shared
 *    display without knowing
 *  - it is one-use and short-lived, and it LEAVES THE SCREEN when it dies
 *
 * Generating it up front "to save a click" would put a live credential on
 * screen for every buyer whether or not they wanted a second device. That's why
 * the button exists.
 *
 * ── THIS PASS: TWO FIXES ───────────────────────────────────────────────
 *
 * 1. THE CODE OUTLIVED ITS OWN VALIDITY. Once generated it stayed rendered
 *    until the component unmounted — on /checkout/success that is the rest of
 *    the session. The token is 300s server-side, so after five minutes the
 *    screen showed a dead QR still captioned "expires in 5 minutes", and
 *    anyone who scanned it got an error with no explanation. Worse, the file's
 *    own security notes promise a credential that isn't left lying around, and
 *    it was. There is now a live countdown, and at zero the QR is replaced
 *    rather than left on screen. A Hide control does the same on demand.
 *
 * 2. THE QR WAS INVISIBLE TO SCREEN READERS. A div of raw SVG with no role and
 *    no label announces nothing at all, so a blind user pressed a button and
 *    got silence. It is now a labelled image, and the countdown is a live
 *    region.
 */

/** Below this the countdown turns amber — enough time to scan, not to linger. */
const URGENT_REMAINING_MS = 60_000;

export function DeviceLinkQr() {
  const [svg, setSvg] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Guards re-entry without putting `loading` in the callback's deps, which
  // would give `generate` a new identity on every state flip.
  const busy = useRef(false);

  // Runs after the QR block mounts, so the element exists to receive it.
  useEffect(() => {
    if (svg) resultRef.current?.focus();
  }, [svg]);

  /**
   * The countdown. Kept in state rather than read at render time: render must
   * be pure, and an impure clock read makes the number shift on any unrelated
   * re-render. 0 means "not yet ticked", true only for the first frame.
   */
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setNow(Date.now());
    // First tick via a 0ms timeout rather than calling setNow() in the effect
    // body — a synchronous setState there cascades a render and the React
    // compiler lint rejects it.
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [expiresAt]);

  const remainingMs = expiresAt && now > 0 ? expiresAt - now : null;

  /**
   * The credential leaves the screen the moment it stops working. Dropping the
   * markup rather than just captioning it "expired" is the point: a dead QR
   * still on screen is a photograph waiting to be taken of something that was
   * live a minute ago.
   */
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && svg) {
      setSvg(null);
      setExpiresAt(null);
      setExpired(true);
    }
  }, [remainingMs, svg]);

  const clear = useCallback(() => {
    setSvg(null);
    setExpiresAt(null);
    setExpired(false);
    setEmail(null);
  }, []);

  const generate = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setExpired(false);

    try {
      const res = await createDeviceLink();

      // Loaded on demand rather than imported at module scope: the QR encoder
      // is ~20KB and would otherwise ship in the bundle for every visitor to
      // every page, to serve a button most people never press.
      const QRCode = (await import("qrcode")).default;

      const markup = await QRCode.toString(res.url, {
        type: "svg",
        // 2 modules of quiet zone. The spec asks for 4; the white card around
        // it supplies the rest, and 1 was tight enough that some phone cameras
        // hunt for the finder patterns.
        margin: 2,
        errorCorrectionLevel: "M",
        // Light modules light, dark modules dark: phone cameras want a light
        // quiet zone, and this site is dark everywhere else, so the code gets
        // its own light card rather than being inverted.
        color: { dark: "#0b0b0d", light: "#ffffff" },
      });

      setSvg(markup);
      setEmail(res.email);
      // Lifetime comes from the SERVER, never a hardcoded string. It is 300s
      // today and the copy must follow if that ever changes — telling someone
      // "30 minutes" about a 5-minute token is a promise the product breaks.
      setExpiresAt(Date.now() + res.expires_in_seconds * 1_000);
      trackCredits("credits_magic_link_requested", { source: "device_qr" });
    } catch (err) {
      // 401 not_linked: this browser has no account. The caller gates on
      // me.authenticated so it shouldn't happen, but saying the real reason
      // beats a generic failure if it ever does.
      if (err instanceof ApiError && err.kind === "not_linked") {
        setError("This browser isn't signed in to an account yet.");
      } else if (err instanceof ApiError && err.isRateLimit) {
        setError("Too many links generated. Try again in a little while.");
      } else {
        setError("Couldn't create a link right now. Try the email option instead.");
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  if (svg) {
    const urgent = remainingMs !== null && remainingMs < URGENT_REMAINING_MS;
    return (
      /*
       * FOCUS IS MOVED HERE ON PURPOSE.
       *
       * The button the user just pressed UNMOUNTS when this replaces it, which
       * drops focus to document.body. The next Tab then lands on the sr-only
       * "Skip to content" link in the header, which becomes visible on focus —
       * so a skip link appears out of nowhere in the middle of the navbar.
       * Catching focus here keeps the tab order where the user actually is,
       * and announces the result instead of silently swapping the region.
       */
      <div ref={resultRef} tabIndex={-1} className="space-y-3 outline-none">
        <div
          role="img"
          aria-label={
            email
              ? `QR code that signs another device in to ${email}`
              : "Sign-in QR code"
          }
          className="mx-auto w-full max-w-[200px] rounded-lg bg-white p-3"
          // The encoder's own SVG output, not user content.
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        {/* The countdown, in the same mono readout language as every other
            number in this product. It is doing real work: this is a live
            credential and the user should be able to see it dying. */}
        <p
          className="flex items-baseline justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]"
          role="timer"
          aria-live="off"
        >
          <span className="text-text-subtle">Expires in</span>
          <span className={urgent ? "text-amber-400" : "text-text-muted"}>
            {formatRemaining(remainingMs)}
          </span>
        </p>

        {email && (
          <p className="text-center text-[11px] text-text-muted">
            Signs in as <span className="text-text-primary">{email}</span>
          </p>
        )}

        <p className="text-center text-[11px] leading-relaxed text-text-subtle">
          Scan with your phone&apos;s camera. Works once — don&apos;t share this
          screen or let it be photographed.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={generate}
            className="flex items-center gap-1.5 rounded text-xs text-text-muted outline-none transition-colors hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            New code
          </button>
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1.5 rounded text-xs text-text-muted outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <EyeOff className="h-3 w-3" aria-hidden />
            Hide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="md"
        loading={loading}
        onClick={generate}
        className="w-full"
      >
        <Smartphone className="h-4 w-4" aria-hidden />
        {expired ? "Show a new code" : "Use on my phone"}
      </Button>
      {error ? (
        <p role="alert" className="text-[11px] leading-relaxed text-red-400">
          {error}
        </p>
      ) : expired ? (
        <p role="status" className="text-[11px] leading-relaxed text-text-subtle">
          That code expired and has been cleared. Generate another whenever you
          need one.
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Shows a QR code to scan — no email, no typing.
        </p>
      )}
    </div>
  );
}

function formatRemaining(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Inline spinner for callers that render their own trigger. */
export function DeviceLinkSpinner() {
  return (
    <Loader2 className="h-4 w-4 animate-spin text-text-subtle motion-reduce:animate-none" />
  );
}