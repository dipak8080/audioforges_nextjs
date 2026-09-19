"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Music2, Power } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ConfirmDialog } from "./ConfirmDialog";

interface MaintenanceState {
  on: boolean;
  message: string;
  since: number | null;
}

const MAX_MESSAGE = 300;

function sinceLabel(since: number | null): string {
  if (!since) return "";
  const mins = Math.floor((Date.now() / 1000 - since) / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function TikTokSwitch() {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    return fetch("/api/admin/tiktok", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<MaintenanceState>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setState(data);
        setMessage(data.message || "");
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const apply = async (on: boolean) => {
    setBusy(true);
    setConfirming(false);
    try {
      const r = await fetch("/api/admin/tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on, message }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
      setState(data as MaintenanceState);
      setMessage((data as MaintenanceState).message || "");
      setToast({ ok: true, text: on ? "TikTok paused. Users now see your message." : "TikTok resumed." });
    } catch (err) {
      setToast({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const on = state?.on ?? false;
  const dirty = state !== null && message.trim() !== (state.message || "").trim();

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">TikTok to MP3</h2>
        {state && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              on ? "bg-red-500/10 text-red-300" : "bg-teal-500/10 text-teal-300"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-red-400" : "bg-teal-400")} />
            {on ? `Paused ${sinceLabel(state.since)}` : "Live"}
          </span>
        )}
      </div>

      <div
        className={cn(
          "mt-3 rounded-2xl border p-4 sm:p-5",
          on ? "border-red-500/30 bg-red-500/[0.05]" : "border-graphite-800 bg-graphite-900"
        )}
      >
        {loadFailed ? (
          <p className="flex items-center gap-2 text-[13px] text-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
            Could not read the switch state. Check that BACKEND_ADMIN_KEY is set, then refresh.
          </p>
        ) : !state ? (
          <div className="h-24 animate-pulse rounded-xl bg-graphite-850" />
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-text-muted">
                {on
                  ? "Every fresh conversion is refused with the message below. Cached results still serve. Turn it off once TikTok works again."
                  : "Pause the tool when TikTok is broken sitewide (canary alert, every job failing). Users get a clear notice instead of a generic error."}
              </p>
              <label htmlFor="tiktok-maint-msg" className="mt-3 block text-[12px] font-medium text-text-subtle">
                Message shown to users
              </label>
              <textarea
                id="tiktok-maint-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                rows={2}
                disabled={busy}
                className="mt-1.5 w-full resize-none rounded-xl border border-graphite-700 bg-graphite-850 px-3 py-2 text-[13px] text-text-primary outline-none transition-colors focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-text-subtle">
                <span>Plain words, no jargon. They read this on the tool page.</span>
                <span className="tabular-nums">{message.length}/{MAX_MESSAGE}</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 lg:w-52">
              {on ? (
                <button
                  type="button"
                  onClick={() => apply(false)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-[13px] font-semibold text-graphite-950 transition-colors hover:bg-teal-400 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  Resume TikTok
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-[13px] font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  Pause TikTok
                </button>
              )}
              {on && dirty && (
                <button
                  type="button"
                  onClick={() => apply(true)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-xl border border-graphite-700 px-4 py-2 text-[12px] text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary disabled:opacity-60"
                >
                  Update message
                </button>
              )}
              <p className="flex items-center gap-1.5 text-[11px] text-text-subtle">
                <Music2 className="h-3 w-3" aria-hidden />
                Takes effect immediately
              </p>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className={cn(
            "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px]",
            toast.ok
              ? "border-teal-500/30 bg-teal-500/[0.07] text-teal-200"
              : "border-red-500/30 bg-red-500/[0.07] text-red-200"
          )}
        >
          {toast.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {toast.text}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Pause TikTok to MP3 for everyone?"
          body="Every new conversion will be refused with your message until you resume it. Cached results keep serving."
          confirmLabel="Pause"
          loading={busy}
          onConfirm={() => apply(true)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}