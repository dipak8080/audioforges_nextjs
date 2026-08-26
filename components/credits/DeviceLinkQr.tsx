"use client";

import { useCallback, useState } from "react";
import { Loader2, Smartphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createDeviceLink } from "@/lib/api/credits";
import { ApiError } from "@/lib/api/railway";
import { trackCredits } from "@/lib/analytics";

/**
 * "Use on my phone" — the four-second version of the magic link.
 *
 * THE PROBLEM IT SOLVES
 *
 * Credits follow the browser cookie. Buy on a laptop, open a phone, and
 * the phone sees zero. The email link already fixes this, but it means
 * switching apps, finding the mail, and waiting on delivery. Scanning a
 * QR off the screen with the phone camera takes about four seconds and
 * involves no typing and no inbox.
 *
 * THE SECURITY POSTURE, STATED PLAINLY
 *
 * The rendered QR encodes a LIVE one-use sign-in credential. Anyone who
 * photographs the screen while it is visible can claim the account. So:
 *
 *  - it is generated on demand, never on page load
 *  - it is never auto-copied to the clipboard and never shown as text
 *  - the screen says what it is, so nobody presents it on a stream or a
 *    shared display without knowing
 *  - it is one-use and 30-minute, same as the emailed link
 *
 * Generating it up front "to save a click" would put a live credential on
 * screen for every buyer whether or not they wanted a second device.
 * That's why the button exists.
 */
export function DeviceLinkQr() {
  const [svg, setSvg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ email: string; expiresInSeconds: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await createDeviceLink();

      // Loaded on demand rather than imported at module scope: the QR
      // encoder is ~20KB and would otherwise ship in the bundle for every
      // visitor to every page, to serve a button most people never press.
      const QRCode = (await import("qrcode")).default;

      const markup = await QRCode.toString(res.url, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        // Light modules light, dark modules dark: phone cameras want a
        // light quiet zone, and this site is dark everywhere else, so the
        // code gets its own light card rather than being inverted.
        color: { dark: "#0b0b0d", light: "#ffffff" },
      });

      setSvg(markup);
      // Lifetime comes from the SERVER, never a hardcoded string. It is
      // 300s today and the copy must follow if that ever changes —
      // telling someone "30 minutes" about a 5-minute token is a promise
      // the product then breaks.
      setMeta({ email: res.email, expiresInSeconds: res.expires_in_seconds });
      trackCredits("credits_magic_link_requested", { source: "device_qr" });
    } catch (err) {
      // 401 not_linked: this browser has no account. The caller gates on
      // me.authenticated so it shouldn't happen, but saying the real
      // reason beats a generic failure if it ever does.
      if (err instanceof ApiError && err.kind === "not_linked") {
        setError("This browser isn't signed in to an account yet.");
      } else if (err instanceof ApiError && err.isRateLimit) {
        setError("Too many links generated. Try again in a little while.");
      } else {
        setError("Couldn't create a link right now. Try the email option instead.");
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  if (svg) {
    const minutes = meta ? Math.max(1, Math.round(meta.expiresInSeconds / 60)) : null;
    return (
      <div className="space-y-3">
        <div
          className="mx-auto w-full max-w-[200px] rounded-lg bg-white p-3"
          // The encoder's own SVG output, not user content.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {meta && (
          <p className="text-center text-[11px] text-text-muted">
            Links to <span className="text-text-primary">{meta.email}</span>
          </p>
        )}
        <p className="text-center text-[11px] leading-relaxed text-text-subtle">
          Scan with your phone&apos;s camera. Works once
          {minutes ? `, expires in ${minutes} ${minutes === 1 ? "minute" : "minutes"}` : ""} —
          don&apos;t share this screen.
        </p>
        <button
          type="button"
          onClick={generate}
          className="flex w-full items-center justify-center gap-1.5 text-xs text-text-muted transition-colors hover:text-amber-400"
        >
          <RefreshCw className="h-3 w-3" />
          Generate a new one
        </button>
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
        <Smartphone className="h-4 w-4" />
        Use on my phone
      </Button>
      {error ? (
        <p role="alert" className="text-[11px] text-red-400">
          {error}
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Shows a QR code to scan — no email, no typing.
        </p>
      )}
    </div>
  );
}

/** Inline spinner for callers that render their own trigger. */
export function DeviceLinkSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin text-text-subtle" />;
}