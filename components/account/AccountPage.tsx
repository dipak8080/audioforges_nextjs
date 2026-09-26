"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, LogOut, Mail } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ToggleRow } from "@/components/converter/ToolControls";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LibrarySection } from "./LibrarySection";
import { LOCALE_INFO } from "@/lib/i18n/locales";
import { useStudioConfig } from "@/lib/studio/use-studio-config";
import {
  fetchEmailPrefs,
  fetchReferral,
  googleSignInUrl,
  passPortalUrl,
  readPass,
  saveEmailPrefs,
  sendMagicLink,
  setPassCancelled,
  signOut,
  type EmailPrefs,
  type ReferralInfo,
  type StudioPassState,
} from "@/lib/studio/account";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 surface rounded-2xl border border-graphite-800 bg-graphite-900 p-5">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">{title}</h2>
      {children}
    </section>
  );
}

function SignInCard() {
  const { t } = useI18n();
  const a = t.account;
  const u = t.unlock;
  const { config } = useStudioConfig();
  const [email, setEmail] = useState("");
  const [updates, setUpdates] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function remember() {
    try {
      window.localStorage.setItem("af_return_to", JSON.stringify({ path: "/account", label: a.title }));
    } catch {}
  }

  async function send() {
    if (!EMAIL_RE.test(email.trim())) return;
    setBusy(true);
    remember();
    const ok = await sendMagicLink(email.trim(), updates);
    setBusy(false);
    setSent(ok);
  }

  return (
    <div className="surface mx-auto max-w-md space-y-4 rounded-2xl border border-graphite-800 bg-graphite-900 p-6">
      <div>
        <h1 className="display text-3xl text-text-primary">{a.signInTitle}</h1>
        <p className="mt-1 text-sm text-text-muted">{a.signInDesc}</p>
      </div>
      {config.googleSignin && (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => {
            remember();
            window.location.href = googleSignInUrl("/account", updates);
          }}
        >
          {u.google}
        </Button>
      )}
      {sent ? (
        <p className="flex items-center gap-2 text-sm text-teal-400">
          <Check className="h-4 w-4" />
          {a.linkSent}
        </p>
      ) : (
        <div className="space-y-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            placeholder={u.emailPlaceholder}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-graphite-700 bg-graphite-950 px-3.5 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-subtle focus-visible:border-amber-500/60"
          />
          <Button variant="outline" size="lg" className="w-full" onClick={() => void send()} loading={busy} disabled={!EMAIL_RE.test(email.trim())}>
            <Mail />
            {a.emailSend}
          </Button>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} className="h-4 w-4 accent-amber-500" />
        {u.updates}
      </label>
    </div>
  );
}

function PassSection({ pass, onChange }: { pass: StudioPassState; onChange: (p: StudioPassState) => void }) {
  const { t, fill, plural, usd, locale } = useI18n();
  const a = t.account;
  const { config } = useStudioConfig();
  const [busy, setBusy] = useState<string | null>(null);
  const date = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "";

  async function toggle(cancel: boolean) {
    setBusy(cancel ? "cancel" : "resume");
    const next = await setPassCancelled(cancel);
    setBusy(null);
    if (next) onChange(next);
  }

  async function portal() {
    setBusy("portal");
    const url = await passPortalUrl();
    setBusy(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!pass.active) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {fill(a.passNone, {
            songs: plural(pass.songsPerMonth, t.songs.count),
            price: usd(pass.priceUsd),
            months: config.pass.rolloverMonths,
          })}
        </p>
        <Link href="/pricing" prefetch={false} className={buttonStyles({ variant: "accent", size: "sm" })}>
          {a.passStart}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-text-primary">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">PASS</span>
        {pass.cancelAtPeriodEnd ? fill(a.passEnds, { date: date(pass.renewsAt) }) : fill(a.passRenews, { date: date(pass.renewsAt) })}
      </p>
      {pass.passSongs > 0 && pass.nextExpiry && (
        <p className="font-mono text-[11px] text-text-muted">
          {fill(a.passSongs, { songs: plural(pass.passSongs, t.songs.count), date: date(pass.nextExpiry) })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {pass.canManage && (
          <Button size="sm" variant="secondary" onClick={() => void portal()} loading={busy === "portal"}>
            {a.passManage}
          </Button>
        )}
        {pass.cancelAtPeriodEnd ? (
          <Button size="sm" variant="accent" onClick={() => void toggle(false)} loading={busy === "resume"}>
            {a.passResume}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => void toggle(true)} loading={busy === "cancel"}>
            {a.passCancel}
          </Button>
        )}
      </div>
      <p className="text-xs text-text-subtle">{fill(t.unlock.passRenew, { price: usd(pass.priceUsd) })}</p>
    </div>
  );
}

function EmailSection() {
  const { t } = useI18n();
  const a = t.account;
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchEmailPrefs().then((p) => alive && setPrefs(p));
    return () => {
      alive = false;
    };
  }, []);

  async function flip(key: "updates" | "notices") {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const ok = await saveEmailPrefs({ [key]: next[key] });
    if (!ok) setPrefs(prefs);
  }

  if (!prefs) return <div className="h-24 rounded-xl bg-graphite-850 motion-safe:animate-pulse" />;
  return (
    <div className="space-y-2">
      {(["updates", "notices"] as const).map((key) => (
        <ToggleRow
          key={key}
          pressed={prefs[key]}
          onToggle={() => void flip(key)}
          iconOn={<Check className="h-4 w-4" />}
          iconOff={<span className="block h-4 w-4 rounded border border-graphite-600" />}
        >
          <span className="block text-text-primary">{key === "updates" ? a.emailUpdates : a.emailNotices}</span>
          <span className="block text-xs text-text-muted">{key === "updates" ? a.emailUpdatesDesc : a.emailNoticesDesc}</span>
        </ToggleRow>
      ))}
    </div>
  );
}

function ReferralSection({ info }: { info: ReferralInfo }) {
  const { t, fill } = useI18n();
  const a = t.account;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(info.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">{fill(a.referralDesc, { n: info.rewardSongs })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-graphite-700 bg-graphite-950 px-3 py-2 font-mono text-xs text-text-body">
          {info.link}
        </code>
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? a.copied : a.copy}
        </Button>
      </div>
      <p className="font-mono text-[11px] text-text-subtle">
        {fill(a.referralStats, { rewarded: info.rewarded, pending: info.pending, earned: info.earned })}
      </p>
    </div>
  );
}

export function AccountPage() {
  const { t, plural } = useI18n();
  const a = t.account;
  const { me, loading, refresh } = useCredits();
  const { config } = useStudioConfig();
  const [pass, setPass] = useState<StudioPassState | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const signedIn = !!me?.authenticated;
  const passState = pass ?? readPass((me as unknown as { studio_pass?: unknown } | null)?.studio_pass);

  useEffect(() => {
    if (!signedIn || !config.referral.enabled) return;
    let alive = true;
    void fetchReferral().then((r) => alive && setReferral(r));
    return () => {
      alive = false;
    };
  }, [signedIn, config.referral.enabled]);

  if (loading && !me) return <div className="mx-auto h-64 max-w-3xl rounded-2xl bg-graphite-900 motion-safe:animate-pulse" />;
  if (!signedIn) return <SignInCard />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl text-text-primary">{a.title}</h1>
          <p className="mt-1 font-mono text-xs text-text-muted">{me?.email}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void signOut().then(() => {
              void refresh({ reset: true });
            })
          }
        >
          <LogOut />
          {a.signOut}
        </Button>
      </div>

      <Section title={a.balance}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="display text-3xl text-text-primary">{plural(me?.balance ?? 0, t.songs.count)}</p>
          <Link href="/pricing" prefetch={false} className={buttonStyles({ variant: "outline", size: "sm" })}>
            {a.buySongs}
          </Link>
        </div>
      </Section>

      {passState && (passState.available || passState.active) && (
        <Section id="pass" title={a.passTitle}>
          <PassSection pass={passState} onChange={setPass} />
        </Section>
      )}

      <Section id="library" title={a.libraryTitle}>
        {config.library.enabled ? (
          <LibrarySection retentionDays={config.library.retentionDays} />
        ) : (
          <p className="text-sm text-text-muted">{a.libraryOff}</p>
        )}
      </Section>

      <Section id="email" title={a.emailTitle}>
        <EmailSection />
      </Section>

      {referral?.enabled && (
        <Section id="invite" title={a.referralTitle}>
          <ReferralSection info={referral} />
        </Section>
      )}
    </div>
  );
}