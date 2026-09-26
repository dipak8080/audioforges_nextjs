"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ExternalLink, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { OptionCards } from "@/components/converter/ToolControls";
import { ApiError } from "@/lib/api/railway";
import { getCreditsMe } from "@/lib/api/credits";
import { createDodoCheckout } from "@/lib/api/dodo";
import { googleSignInUrl } from "@/lib/studio/account";
import { useStudioConfig } from "@/lib/studio/use-studio-config";
import { saveResume } from "@/lib/studio/resume";
import { trackStudio } from "@/lib/studio/track";
import type { StudioSelection } from "@/lib/studio/presets";
import type { StartedRun } from "@/lib/studio/run";
import type { PackKey } from "@/lib/types/credits";

const EMAIL_KEY = "af_claim_email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WATCH_MS = 15 * 60_000;

type Choice = PackKey | "pass";
type Phase = "choose" | "opening" | "waiting" | "blocked" | "done";

export function UnlockSheet({
  open,
  songsNeeded,
  title,
  run,
  selection,
  onClose,
  onPaid,
}: {
  open: boolean;
  songsNeeded: number;
  title: string;
  run: StartedRun;
  selection: StudioSelection;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { t, fill, plural, usd, cents } = useI18n();
  const u = t.unlock;
  const pathname = usePathname() ?? "/";
  const { me, balance, applyBalance, refresh } = useCredits();
  const { config } = useStudioConfig();

  const packs = useMemo(() => [...(me?.packs ?? [])].sort((a, b) => a.price_usd - b.price_usd), [me?.packs]);
  const defaultPack = packs.find((p) => p.credits >= songsNeeded) ?? packs[0];
  const [picked, setPicked] = useState<Choice | null>(null);
  const choice: Choice | null = picked ?? defaultPack?.key ?? null;

  const signedIn = !!me?.authenticated;
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [updates, setUpdates] = useState(false);
  const [phase, setPhase] = useState<Phase>("choose");
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const baseline = useRef(0);
  const watchStart = useRef(0);
  const settled = useRef(false);

  const payEmail = signedIn && me?.email ? me.email : email.trim();
  const passChosen = choice === "pass";
  const pack = packs.find((p) => p.key === choice);
  const priceUsd = passChosen ? config.pass.priceUsd : pack?.price_usd ?? 0;

  const check = useCallback(async () => {
    if (settled.current) return;
    const fresh = await getCreditsMe().catch(() => null);
    if (fresh && fresh.balance > baseline.current) {
      settled.current = true;
      applyBalance(fresh.balance);
      void refresh();
      setPhase("done");
      trackStudio(passChosen ? "studio_pass_started" : "studio_purchase", { choice });
      window.setTimeout(onPaid, 700);
    }
  }, [applyBalance, choice, onPaid, passChosen, refresh]);

  useEffect(() => {
    if (!open || (phase !== "waiting" && phase !== "blocked")) return;
    const timer = window.setInterval(() => {
      if (Date.now() - watchStart.current > WATCH_MS) window.clearInterval(timer);
      else void check();
    }, 4000);
    const onBack = () => document.visibilityState === "visible" && void check();
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [open, phase, check]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function google() {
    saveResume({ run, selection, title, path: pathname });
    window.location.href = googleSignInUrl(pathname, updates);
  }

  async function pay() {
    if (!choice) return;
    if (passChosen && !signedIn) {
      setError(u.passNeedsSignIn);
      return;
    }
    if (!EMAIL_RE.test(payEmail)) {
      setError(u.emailInvalid);
      return;
    }
    setError(null);
    try {
      window.localStorage.setItem(EMAIL_KEY, payEmail);
    } catch {}
    const tab = window.open("", "_blank");
    if (tab) {
      try {
        tab.document.title = "Opening checkout";
        tab.document.body.style.cssText =
          "background:#151515;color:#bbb;font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0";
        tab.document.body.textContent = "Opening secure checkout...";
      } catch {}
    }
    setPhase("opening");
    trackStudio("studio_checkout_started", { choice });
    try {
      const url = await createDodoCheckout(choice as PackKey, payEmail);
      setCheckoutUrl(url);
      baseline.current = balance;
      watchStart.current = Date.now();
      settled.current = false;
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = url;
        setPhase("waiting");
      } else {
        setPhase("blocked");
      }
    } catch (err) {
      tab?.close();
      setPhase("choose");
      setError(err instanceof ApiError && err.message ? err.message : u.checkoutError);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={u.title}>
      <button type="button" aria-label={u.close} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="surface grain relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-graphite-700 bg-graphite-900 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-graphite-800 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
              {t.panel.engine}
            </p>
            <p className="display mt-1 text-2xl text-text-primary">{u.title}</p>
            <p className="mt-0.5 truncate text-sm text-text-muted">{title}</p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label={u.close} onClick={onClose}>
            <X />
          </Button>
        </div>

        {phase === "done" ? (
          <div className="flex items-center gap-3 px-5 py-8" role="status">
            <Check className="h-5 w-5 text-teal-400" />
            <p className="text-text-primary">{t.run.separating}</p>
          </div>
        ) : phase === "waiting" || phase === "blocked" ? (
          <div className="space-y-4 px-5 py-6" role="status" aria-live="polite">
            {phase === "blocked" && checkoutUrl ? (
              <>
                <p className="text-sm text-text-muted">{u.blocked}</p>
                <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles({ variant: "accent", size: "lg", className: "w-full" })}>
                  {u.openCheckout}
                  <ExternalLink />
                </a>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-text-primary">
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                {u.waiting}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <p className="text-sm text-text-muted">{u.subtitle}</p>

            <OptionCards
              label={u.packs}
              columns={1}
              value={choice ?? ""}
              onChange={(v) => setPicked(v)}
              options={[
                ...packs.map((p) => ({
                  value: p.key as Choice,
                  title: plural(p.credits, t.songs.count),
                  meta: usd(p.price_usd),
                  detail: `${fill(u.perSong, { price: cents(p.price_usd / p.credits) })} · ${t.songs.neverExpire}`,
                })),
                ...(config.pass.available
                  ? [
                      {
                        value: "pass" as Choice,
                        title: u.passTitle,
                        meta: fill(u.perMonth, { price: usd(config.pass.priceUsd) }),
                        detail: `${fill(u.passMeta, { n: config.pass.songsPerMonth })} · ${u.passBest}`,
                        premium: true,
                      },
                    ]
                  : []),
              ]}
            />

            {signedIn ? (
              <p className="flex items-center gap-2 text-sm text-text-body">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                {fill(u.signedInAs, { email: me?.email ?? "" })}
              </p>
            ) : (
              <div className="space-y-3">
                {config.googleSignin && (
                  <Button variant="secondary" size="lg" className="w-full" onClick={google}>
                    <GoogleMark />
                    {u.google}
                  </Button>
                )}
                <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{u.or}</p>
                <label className="block">
                  <span className="mb-1 block text-xs text-text-muted">{u.emailLabel}</span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    placeholder={u.emailPlaceholder}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-graphite-700 bg-graphite-950 px-3.5 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-subtle focus-visible:border-amber-500/60"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} className="h-4 w-4 accent-amber-500" />
                  {u.updates}
                </label>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button variant="accent" size="lg" className="w-full" onClick={() => void pay()} loading={phase === "opening"} disabled={!choice || phase === "opening"}>
              {passChosen ? fill(u.startPass, { price: usd(config.pass.priceUsd) }) : fill(u.pay, { price: usd(priceUsd) })}
            </Button>
            {passChosen && <p className="text-center text-xs text-text-muted">{fill(u.passRenew, { price: usd(config.pass.priceUsd) })}</p>}

            <ul className="space-y-1 border-t border-graphite-800 pt-4 font-mono text-[11px] text-text-muted">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-teal-400" />
                {u.proofWav}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-teal-400" />
                {u.proofRefund}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-teal-400" />
                <Link href="/vocal-remover-comparison" prefetch={false} target="_blank" className="underline underline-offset-4 hover:text-text-primary">
                  {u.proofTest}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.3 6.6 2.3 12s4.3 9.8 9.7 9.8c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}