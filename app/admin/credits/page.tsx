"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RefreshControl } from "../_components/RefreshControl";
import { GatePanel } from "../_components/GatePanel";
import { InsightsPanel } from "../_components/InsightsPanel";
import { OrdersPanel } from "../_components/OrdersPanel";
import { SettingsPanel } from "../_components/SettingsPanel";
import { AUTO_MS, VIEWS } from "../_components/credits/credits-types";
import type { JobsPreset, View } from "../_components/credits/credits-types";
import { useInflight } from "../_components/credits/credits-net";
import { money, num } from "../_components/credits/credits-format";
import { useOverview, useShellHeight } from "../_components/credits/credits-hooks";
import { Pill, STYLES, ToastStack, useToasts } from "../_components/credits/CreditsUi";
import { LookupPanel } from "../_components/credits/LookupPanel";
import { OverviewPanel } from "../_components/credits/OverviewPanel";
import { ReadPanel } from "../_components/credits/ReadPanel";

export default function AdminCreditsRoute() {
  return (
    <Suspense fallback={null}>
      <AdminCreditsPage />
    </Suspense>
  );
}

function AdminCreditsPage() {
  const params = useSearchParams();
  const [view, setView] = useState<View>(() => {
    const wanted = params.get("view");
    return VIEWS.some((v) => v.id === wanted) ? (wanted as View) : "lookup";
  });
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(false);
  const [jobsPreset, setJobsPreset] = useState<JobsPreset | null>(null);
  const [lookupPreset, setLookupPreset] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();
  const overview = useOverview(tick);
  const [shellRef, shellHeight] = useShellHeight();

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const { busy, lastUpdated } = useInflight();

  const switchView = useCallback((next: View) => {
    setJobsPreset(null);
    setLookupPreset(null);
    setView(next);
  }, []);

  const goToCustomer = useCallback((email: string) => {
    setLookupPreset(email);
    setView("lookup");
  }, []);

  const goToJobs = useCallback((preset: JobsPreset) => {
    setJobsPreset(preset);
    setView("jobs");
  }, []);

  useEffect(() => {
    if (!auto || busy) return;
    const wait = lastUpdated ? Math.max(0, lastUpdated + AUTO_MS - Date.now()) : AUTO_MS;
    const id = window.setTimeout(refresh, wait);
    return () => window.clearTimeout(id);
  }, [auto, busy, lastUpdated, refresh]);

  // Keyboard: 1–5 switch views, r refreshes. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= VIEWS.length) switchView(VIEWS[n - 1].id);
      if (e.key.toLowerCase() === "r") refresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh, switchView]);

  const active = VIEWS.find((v) => v.id === view) ?? VIEWS[0];

  return (
    <div
      ref={shellRef}
      style={shellHeight ? { height: shellHeight } : undefined}
      className="flex w-full flex-col overflow-hidden bg-graphite-950 text-text-primary"
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ===== fixed chrome ===== */}
      <header className="shrink-0 border-b border-graphite-800 pt-3">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
              <Coins className="h-4 w-4 text-amber-400" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Credits</h1>
              <p className="truncate text-[11px] text-text-subtle">{active.hint}</p>
            </div>

            <RefreshControl
              className="ml-auto"
              busy={busy}
              lastUpdated={lastUpdated}
              onRefresh={refresh}
              auto={auto}
              onAutoChange={setAuto}
              autoEveryMs={AUTO_MS}
            />
          </div>

          <div className="af-railless -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Pill
              label="Unspent credits"
              title="Credits people bought and have not used yet"
              value={num(overview?.credits_outstanding)}
              tone="accent"
            />
            <Pill label="Accounts" value={num(overview?.accounts)} />
            <Pill
              label="Credits on hold"
              title="Jobs that took a credit and have not finished"
              value={num(overview?.holds_open)}
              tone={overview?.holds_open ? "alarm" : "plain"}
            />
            <Pill
              label="Unmatched payments"
              title="Ko-fi payments that did not reach an account"
              value={num(overview?.webhooks_unprocessed)}
              tone={overview?.webhooks_unprocessed ? "alarm" : "plain"}
            />
            <Pill label="GPU spend, 30 days" value={money(overview?.usage?.est_cost_usd, 2)} />
          </div>

          <nav className="af-railless -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Credits views">
            {VIEWS.map((v) => {
              const on = v.id === view;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => switchView(v.id)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-[13px] font-medium outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                    on ? "text-amber-400" : "text-text-muted hover:text-text-primary"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {v.label}
                  <span
                    className={cn(
                      "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                      on ? "bg-amber-400" : "bg-transparent"
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ===== the only region that scrolls lives inside here ===== */}
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6">
        {view === "lookup" ? (
          <LookupPanel onToast={push} onChanged={refresh} preset={lookupPreset} />
        ) : view === "overview" ? (
          <OverviewPanel data={overview} onToast={push} onChanged={refresh} />
        ) : view === "orders" ? (
          <OrdersPanel tick={tick} onOpenCustomer={goToCustomer} />
        ) : view === "gate" ? (
          <GatePanel tick={tick} />
        ) : view === "insights" ? (
          <InsightsPanel tick={tick} />
        ) : view === "settings" ? (
          <SettingsPanel tick={tick} onToast={push} />
        ) : (
          <ReadPanel key={view} view={view} tick={tick} preset={jobsPreset} onGoToJobs={goToJobs} />
        )}
      </main>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}