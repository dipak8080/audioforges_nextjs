"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Music2 } from "lucide-react";
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
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
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
    const t = setTimeout(() => setToast(null), 3000);
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
      setToast({ ok: true, text: on ? "Paused" : "Resumed" });
    } catch (err) {
      setToast({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const on = state?.on ?? false;
  const dirty = state !== null && message.trim() !== (state.message || "").trim();

  return (
    <div
      className={cn(
        "mt-px flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center",
        on ? "border-red-500/30 bg-red-500/[0.05]" : "border-graphite-800 bg-graphite-900"
      )}
    >
      <div className="flex shrink-0 items-center gap-2 sm:w-44">
        <Music2 className="h-3.5 w-3.5 text-text-subtle" aria-hidden />
        <span className="text-[13px] font-medium text-text-primary">TikTok to MP3</span>
        {state && (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium sm:ml-1",
              on ? "bg-red-500/10 text-red-300" : "bg-teal-500/10 text-teal-300"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-red-400" : "bg-teal-400")} />
            {on ? `Paused ${sinceLabel(state.since)}` : "Live"}
          </span>
        )}
      </div>

      {loadFailed ? (
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-red-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
          Switch state did not load. Check BACKEND_ADMIN_KEY, then refresh.
        </p>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            disabled={busy || !state}
            placeholder="Message users see while paused"
            aria-label="Message shown to users while TikTok to MP3 is paused"
            title="Shown verbatim on the tool page while paused"
            className="h-8 min-w-0 flex-1 rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-[12px] text-text-primary placeholder:text-text-subtle outline-none transition-colors focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
          />
          {on && dirty && (
            <button
              type="button"
              onClick={() => apply(true)}
              disabled={busy}
              className="h-8 shrink-0 rounded-lg border border-graphite-700 px-3 text-[12px] text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary disabled:opacity-60"
            >
              Save
            </button>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-3 sm:pl-1">
        {toast && (
          <span
            role="status"
            className={cn("flex items-center gap-1 text-[11px]", toast.ok ? "text-teal-300" : "text-red-300")}
          >
            {toast.ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {toast.text}
          </span>
        )}
        <span className="text-[11px] text-text-subtle">{on ? "Paused" : "Pause"}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? "Resume TikTok to MP3" : "Pause TikTok to MP3"}
          disabled={busy || !state}
          onClick={() => (on ? apply(false) : setConfirming(true))}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-50",
            on ? "bg-red-500" : "bg-graphite-700"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform",
              on ? "translate-x-[18px]" : "translate-x-0.5"
            )}
          >
            {busy && <Loader2 className="h-2.5 w-2.5 animate-spin text-graphite-900" />}
          </span>
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Pause TikTok to MP3 for everyone?"
          body="Every new conversion is refused with your message until you resume. Cached results keep serving. Use this when TikTok is broken sitewide, not for a single bad video."
          confirmLabel="Pause"
          loading={busy}
          onConfirm={() => apply(true)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}